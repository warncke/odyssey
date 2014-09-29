package Odyssey::Wiki;

use strict;
use warnings;

use AnyEvent;
use AnyEvent::Curl::Multi;
use Data::Dumper;
use EV;
use HTML::Entities qw(decode_entities);
use HTTP::Request;
use Storable qw(nstore retrieve);
use Time::HiRes qw(sleep);


# constructor

sub new
{
    my($class, %args) = @_;

    my $self = {
        # requests in progress
        active => {},
        # url to start from
        base_url => '',
        # Curl HTTP client
        client => AnyEvent::Curl::Multi->new,
        # completed requests
        complete => {},
        # keep track of how many levels of links we have
        # followed from base url
        level => {},
        # maximum depth to recursively follow links
        max_level => 1,
        # keywords to ignore
        skip => [],
    };

    bless($self, $class);

    $self->{base_url} = $self->wiki_url( $args{base_url} )
        or die "base_url required";

    $self->{max_level} = $args{max_level}
        if defined $args{max_level};

    # optional list of keywords to ignore
    if ( $args{skip} ) {
        for my $term ( @{$args{skip}} ) {
            # replaces spaces with wildcard so we can match
            # on either urls or titles
            $term =~ s{ }{.}g;
            # create regular expression
            my $re = qr{$term}i;

            push(@{$self->skip}, $re);
        }
    }

    # maximum number of concurrent requests
    my $max_concurrency = $args{max_concurrency} || 10;
    $self->client->max_concurrency($max_concurrency);
    # setup curl callbacks
    $self->client->reg_cb(
        error => sub { $self->error(@_) }
    );
    $self->client->reg_cb(
        response => sub { $self->response(@_) }
    );

    return $self;
}

# methods

sub error
{
    my($self, $client, $request, $errmsg, $stats) = @_;

    warn "ERROR: $errmsg";

    # get original url as string
    my $url = $request->uri->as_string;
    # remove URL from active list
    my $handle = delete $self->active->{$url};
    # send signal that we have completed request
    $handle->cv->send;
}

sub get
{
    my($self) = @_;
    # start from base URL
    $self->get_url( $self->base_url );
    # loop as long as there are active requests
    while (keys %{$self->active})
    {
        my($handle) = values %{$self->active};
        # wait for signal that request is complete
        $handle->cv->recv;
    }
}

sub get_url
{
    my($self, $url) = @_;

    $url = $self->wiki_url($url)
        or return;
    # build http request
    my $request = HTTP::Request->new(GET => $url);
    # get string form after going through URI which
    # will apply URL encoding
    $url = $request->uri->as_string;
    # do not get if already requested
    return if $self->active->{$url}
        or $self->complete->{$url};

    print "REQUEST: $url\n";

    $self->active->{$url} = $self->client->request($request);
}

sub parse
{
    my($self, $url, $response) = @_;
    # get the level of the currently requested URL
    my $level = $self->level->{$url} || 0;
    # extract text of article in wiki markup from the edit box
    my($text) = $response->content =~ m{<textarea .*? name="wpTextbox1" class="mw-ui-input">(.*?)</textarea>}s
        or return;
    # text will typically have html encoded entities in it
    $text = decode_entities($text);
    # extract all links from article
    my $links = $self->parse_links($text);
    # if this is the base page then follow all links
    if ($level == 0) {
        # request more URLs
        for my $link (@$links)
        {
            # store level of the URL being requested
            $self->level->{$link} = $level + 1;
            $self->get_url($link);
        }
    }
    # if this is a child page then apply more complex
    # parsing rules
    else {
        $self->parse_child($url, $text, $links, $level);
    }
}

sub parse_child
{
    my($self, $url, $text, $links, $level) = @_;

    # we are only looking for pages on people, places, etc
    # with defined infoboxes containing meta data
    my($type, $infobox) = $self->parse_infobox($text)
        or return;

    my $entity = {
        info  => $infobox,
        level => $level,
        links => $links,
        text  => $text,
        type  => $type,
    };

    my($title) = $url =~ m{title=(.*?)&};

    nstore($entity, "entities/$title.sto");

    # only crawl up to max_level
    return if $level >= $self->max_level;
    # request more URLs
    for my $link (@$links)
    {
        # store level of the URL being requested
        $self->level->{$link} = $level + 1;

        $self->get_url($link);
    }
}

sub parse_infobox
{
    my($self, $text) = @_;

    my($infobox_text, $infobox_type) = $text =~ m/(\{\{Infobox (\w+).*?^\}\}$)/ms
        or return;

    my $infobox = {};

    my @lines = split(/\n/, $infobox_text);

    for my $line (@lines)
    {
        next unless $line =~ m{^\s*\|(\w+)\s*=\s*(.*)};
        my $key = $1 or next;
        my $val = $2 or next;

        $infobox->{$key} = $val;
    }

    return($infobox_type, $infobox);
}

sub parse_links
{
    my($self, $text) = @_;

    my $links = [];

    LINK:
    while ( $text =~ m/\[\[(.*?)\]\](?:\{\{(.*?)\}\})?/g )
    {
        my $link = $1 // '';
        my $flag = $2 // '';

        # skip links requiring disambiguation
        next if $flag =~ m{^Disambiguation needed}i;
        # skip non article internal links (e.g. category:)
        next if $link =~ m{^\w+:};
        # skip link if it matches any of the terms in the skip list
        # which are pre-compiled regular expressions
        for my $re ( @{$self->skip} )
        {
            next LINK if $link =~ $re;
        }
        # link may have both an article name and display name
        my($article, $display) = split(/\|/, $link);
        # get wiki url from article name
        my $url = $self->wiki_url($article)
            or next;

        push(@$links, $url);
    }

    return $links;
}

sub response
{
    my($self, $client, $request, $response, $stats) = @_;

    # get original url as string
    my $url = $request->uri->as_string;

    print "RESPONSE: $url\n";

    # parse response
    $self->parse($url, $response);
    # add URL to complete list
    $self->complete->{$url} = 1;
    # remove URL from active list
    if ( my $handle = delete $self->active->{$url} ) {
        # send signal that we have completed request
        $handle->cv->send;
    }
    else {
        warn "XXX: $url";
    }
}

sub wiki_url
{
    my($self, $url) = @_;

    return unless $url;

    # if this is not a url then assume it is title
    if ( $url !~ m{/} ) {
        # decode HTML entities like &amp
        $url = decode_entities($url);
        # replace any spaces with underscore
        $url =~ s{ }{_}g;
        return "http://en.wikipedia.org/w/index.php?title=$url&action=edit";
    }
    # if this is a non edit url then return edit url
    return "http://en.wikipedia.org/w/index.php?title=$1&action=edit"
        if $url =~ m{wikipedia\.org/wiki/([^/]+)$};
    # require edit url
    return unless $url =~ m{wikipedia\.org/w/index\.php\?title=.*?&action=edit};
    # add http if not already set
    $url = "http://$url"
        unless $url =~ m{^http};

    return $url;
}

# accessors

sub active { $_[0]->{active} }
sub base_url { $_[0]->{base_url} }
sub client { $_[0]->{client} }
sub complete { $_[0]->{complete} }
sub level { $_[0]->{level} }
sub max_level { $_[0]->{max_level} }
sub queue { $_[0]->{queue} }
sub skip { $_[0]->{skip} }

1;
