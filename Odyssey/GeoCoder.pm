package Odyssey::GeoCoder;

require Exporter;
@ISA       = qw(Exporter);
@EXPORT_OK = qw(
    geo_coder
);

use strict;
use warnings;

use Data::Dumper;
use DBI;
use Geo::Coder::OSM;
use Geo::Coder::Google;

our $osm    = Geo::Coder::OSM->new();
our $google = Geo::Coder::Google->new(apiver => 3);

my $dbh = DBI->connect("DBI:mysql:database=odyssey;mysql_enable_utf8=1", "odyssey", "odyssey");

$dbh->{FetchHashKeyName} = 'NAME_lc';
$dbh->{LongReadLen} = 1024**3;
$dbh->{RaiseError} = 1;

my $select_sth = $dbh->prepare('SELECT * FROM geo_location WHERE location = ?');
my $insert_sth = $dbh->prepare('INSERT INTO geo_location VALUES(?,?,?)');



sub geo_coder
{
    my($location) = @_;

    # try database
    $select_sth->execute($location);

    if (my $geocode = $select_sth->fetchrow_hashref) {
        return unless defined $geocode->{lat} && defined $geocode->{lng};
        return {
            lat => $geocode->{lat},
            lng => $geocode->{lng},
        };
    }

    # if we got OSM result then use it
    if ( my($geocode) = $osm->geocode(location => $location) ) {
        # store result in DB
        $insert_sth->execute($location, $geocode->{lat}, $geocode->{lon});

        return {
            lat => $geocode->{lat},
            lng => $geocode->{lon},
        }
    }
    # otherwise try Google
    else {
        # store null result in DB
        $insert_sth->execute($location, undef, undef);
        return;
    }
}

1;
