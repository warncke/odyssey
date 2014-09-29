CREATE TABLE `wiki_redirect` (
  `old_title` varchar(255) DEFAULT NULL,
  `new_title` varchar(255) DEFAULT NULL,
  KEY `old_title` (`old_title`),
  KEY `new_title` (`new_title`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

