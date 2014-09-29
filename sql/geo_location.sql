CREATE TABLE `geo_location` (
  `location` varchar(255) DEFAULT NULL,
  `lat` decimal(8,5) DEFAULT NULL,
  `lng` decimal(8,5) DEFAULT NULL,
  KEY `location` (`location`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

