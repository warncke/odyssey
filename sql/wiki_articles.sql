CREATE TABLE `wiki_articles` (
  `title` varchar(255) DEFAULT NULL,
  `text` text,
  KEY `title` (`title`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

