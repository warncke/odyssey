package Odyssey::Wiki::Article;

use strict;
use warnings;

use Data::Dumper;
use DBI;
use Digest::MD5 qw(md5_hex);
use URI::Escape qw(uri_escape);

use Odyssey::GeoCoder qw(geo_coder);

my $dbh = DBI->connect("DBI:mysql:database=odyssey;mysql_enable_utf8=1", "odyssey", "odyssey");

$dbh->{FetchHashKeyName} = 'NAME_lc';
$dbh->{LongReadLen} = 1024**3;
$dbh->{RaiseError} = 1;

my $articles_sth = $dbh->prepare('SELECT * FROM wiki_articles WHERE title = ?');
my $redirect_sth = $dbh->prepare('SELECT * FROM wiki_redirect WHERE old_title = ?');



sub new
{
    my($class, $title) = @_;

    return unless defined $title;

    my $self;

    # try to get article by title
    $articles_sth->execute($title);
    # return if successful
    return bless($self, $class)
        if $self = $articles_sth->fetchrow_hashref;
    # try to get redirect
    $redirect_sth->execute($title);
    # nothing left to do if title is not in articles
    # or redirect table
    my $redirect = $redirect_sth->fetchrow_hashref
        or return;
    # try getting article with title from redirect
    $articles_sth->execute( $redirect->{new_title} );
    # return if successful
    return bless($self, $class)
        if $self = $articles_sth->fetchrow_hashref;

    return;
}

sub geocode
{
    my($self) = @_;

    my $infobox = $self->infobox;

    # try to get geocode for location
    if ( my $location = $infobox->{location} ) {
        if ( my $geocode = geo_coder($location) ) {
            $infobox->{geocode} = $geocode;
        }
    }
}

sub infobox
{
    my($self) = @_;

    return $self->{infobox} if $self->{infobox};

    my $text = $self->text;

    my($infobox_text, $infobox_type) = $text =~ m/(\{\{Infobox ([\w\s]+).*?^\}\}$)/ms
        or return;

    $infobox_type =~ s{^\s|\s$}{}g;

    return unless length $infobox_type > 3;

    $infobox_type = uc $infobox_type;

    # OFFICEHOLDER is used for PERSON where the person has had
    # political activity, but it is really a PERSON
    $infobox_type = 'PERSON'
        if $infobox_type eq 'OFFICEHOLDER';

    my $infobox = $self->{infobox} = {
        entity_type => $infobox_type,
    };

    my @lines = split(/\n/, $infobox_text);

    for my $line (@lines)
    {
        next unless $line =~ m{^\s*\|\s*(\w+)\s*=\s*(.*)};
        my $key = $1 or next;
        my $val = $2 or next;

        # aliases
        $key = 'location'
            if $key eq 'location_city';

        # process key people
        if ($key eq 'key_people') {
            if ($val =~ /<br/) {
                my $key_people = $infobox->{key_people} = {};

                # data should be list separated by breaks of names and titles
                my @lines = split(/\s*<br.*?>\s*/, $val);

                while (@lines) {
                    my $name = shift @lines or next;
                    my $title;
                    # name and title on line
                    if ($name =~ m{\(}) {
                        ($title) = $name =~ m{\((.*?)\)};
                    }
                    # title on new line
                    else {
                        $title = shift @lines or next;
                    }
                    $name  = strip_markup($name)  or next;
                    $title = strip_markup($title) or next;
                    $title =~ s{[()]}{}g;

                    $key_people->{$name} = $title;
                }
            }
            elsif ($val =~ /{{unbulleted list/) {
                my $key_people = $infobox->{key_people} = {};

                my @items = split(/\s*\|\s*/, $val);
                # ignore first item
                shift @items;

                for my $item (@items) {
                    my($name, $title) = split(/\s*,\s*/, $item);
                    next unless $name && $title;
                    $name  = strip_markup($name)  or next;
                    $title = strip_markup($title) or next;
                    $key_people->{$name} = $title;
                }
            }
        }
        elsif ( grep {$_ eq $key} qw (operating_income revenue market_cap equity assets net_income) ) {
            # strip leading parkup which may be loss
            $val =~ s/^\s*{{(.*?)}}\s*//;
            # this may be profit/loss increase/decrease
            my $change = $1;

            $val = strip_markup($val);

            $infobox->{$key}->{$val} = $change =~ m{loss|decrease} ? 0 : 1;
        }
        elsif ($key eq 'location') {
            # grab the first as the primary location
            my($location) = split(/\s*<br.*?>\s*/, $val);

            $location = strip_markup($location);

            $infobox->{location} = $location;
        }
        elsif ($key eq 'traded_as') {
            my $traded_as = $infobox->{traded_as} = {};

            while ($val =~ m/{{(.*?)}}/g) {
                my($exchange, $symbol) = split(/\s*\|\s*/, $1);
                next unless $exchange && $symbol;
                $exchange =~ s{symbol}{}i;
                $exchange = uc $exchange;
                $exchange = 'NYSE' if $exchange eq 'NEW YORK STOCK EXCHANGE';
                $traded_as->{$exchange}->{$symbol} = 1;
            }
        }
        elsif ($key eq 'industry') {
            my $industry = $infobox->{industry} = {};

            for my $text ( split(/\s*<br.*?>\s*/, $val) ) {
                $text = strip_markup($text);

                $industry->{$text} = 1;
            }
        }
        elsif ( grep {$_ eq $key} qw(name num_employees occupation company_type type alma_mater residence location) ) {
            if ($val =~ m{<br}) {
                my @vals = split(/<br.*?>/, $val);

                $val = {};

                for my $v (@vals) {
                    $v = strip_markup($v);
                    next unless $v && length $v;
                    $val->{$v} = 1;
                }

                $infobox->{$key} = $val
                    if keys %$val;
            }
            else {
                $val = strip_markup($val);
                $infobox->{$key} = $val;
            }
        }
        elsif ( grep {$_ eq $key} qw(image logo) ) {
            $infobox->{$key} = $val;
        }
    }

    # build URL for image / logo
    if (my $image = $infobox->{logo} || $infobox->{image}) {
        my($filename) = $image =~ m{(?:File|Image):([^|]+)};

        if (!$filename) {
            $filename = strip_markup($image);
        }

        if ($filename) {
            $filename =~ s{^\s|\s$}{}g;
            $filename =~ s{ }{_}g;

            my $new_filename = $filename =~ m{svg$} ? "$filename.png" : $filename;

            my $digest = md5_hex($filename);

            $infobox->{image_url} = sprintf(
                'http://upload.wikimedia.org/wikipedia/commons/thumb/%s/%s/%s/200px-%s',
                substr($digest, 0, 1),
                substr($digest, 0, 2),
                uri_escape($filename),
                $new_filename,
            );
        }
    }

    return $infobox;
}

sub links
{
    my($self) = @_;

    my $links = [];

    my $text = $self->text;

    LINK:
    while ($text =~ m/\[\[(.*?)\]\](?:\{\{(.*?)\}\})?/g)
    {
        my $link = $1 // '';
        my $flag = $2 // '';

        # skip links requiring disambiguation
        next if $flag =~ m{^Disambiguation needed}i;
        # skip non article internal links (e.g. category:)
        next if $link =~ m{^\w+:};
        # link may have both an article name and display name
        my($article, $display) = split(/\|/, $link);

        push(@$links, $article);
    }

    return $links;
}

sub overview
{
    my($self) = @_;

    my($overview) = $self->text =~ m{^(.*?)^=}ms;
    return unless defined $overview;

    $overview = strip_markup($overview);

    $overview =~ s{\n+}{\n\n}g;

    return $overview;
}

sub extract_year
{
    my($text) = @_;

    $text =~ s{\s*\((\d{4})\)\s*}{};
    my $year = $1;

    return($text, $year);
}

sub strip_markup
{
    my($text) = @_;

    return unless defined $text;

    $text =~ s/^\[\[File.*?$//msg;

    while ($text =~ m{(\[\[(.*?)\]\])}g) {
        my $outer = $1;
        my $inner = $2;

        my($link, $name) = split(/\|/, $inner);
        $name = $name // $link;

        next unless defined $name;

        $text =~ s/\Q$outer\E/$name/;
    }

    $text =~ s/\{\{[^{^}]+\}\}//msg;
    $text =~ s/\{\{Infobox.*?^\}\}//msg;
    $text =~ s/<ref.*?>.*?<\/ref>//msg;
    $text =~ s/\[\[//g;
    $text =~ s/\]\]//g;
    $text =~ s/<.*?>//g;
    $text =~ s/{{.*?}}//g;
    $text =~ s/{{//g;
    $text =~ s/}}//g;
    $text =~ s/&nbsp;/ /g;
    $text =~ s/'''//g;
    $text =~ s/\(.*?\)//g;
    $text =~ s/ +/ /g;
    $text =~ s{^\s*|\s*$}{}g;

    return $text;
}

# accessors

sub text { $_[0]->{text} }
sub title { $_[0]->{title} }

1;
