Odyssey - Al Jazeera Innovation Challenge

Odyssey includes both a browser based interface for viewing data and backend
utilities for generating Odyssey datasets from Wikipedia XML data dumps.

INSTALLING ODYSSEY

I. Setting Up Database

Odyssey uses MariaDB, which is also compatible with MySQL.  You can use either.

The default settings for database:username:password are odyssey:odyssey:odyssey

Run all of the files in the /sql directory in order to create the necessary
tables.

It is recommended to remove the indexes while loading the data and then add
them back later after the data load is complete in order to improve
performance.

You will need to download a Wikipedia XML dump file from:

https://dumps.wikimedia.org

The file will be something like: enwiki-20140811-pages-articles.xml

Modify /wiki/wiki-xml-loader to include the correct DB credentials if you did
not use the default (all odyssey).

Run: ./wiki/wiki-xml-loader [dump-file.xml]

This process may take up to hours to complete depending on how fast your system
is.  It takes about half-an-hour on a fast server using SSDs for storage.

II. Building Odyssey Data

Running ./odyssey-wiki "WIKIPEDIA ARTICLE NAME" starts the build process for
Odyssey data.

The base article specified at the command line is the starting point.  From
there odyssey-wiki follows links within the article and extracts information
about the entities (People, Places, etc) found.

odyssey-wiki will also retrieve images and perform geo location lookups
using the Open Street Map (OSM) Nominatim geocoding service.

The global variables at the top of odyssey-wiki allow you to configure what
entity types should be retrieved and how many levels of links to follow.

III. Setting Up Web Interface

The contents of the /html directory need to be at the webroot of your server.
The images and json directories where odyssey-wiki puts its build output
should be symlinked from the /html directory.
