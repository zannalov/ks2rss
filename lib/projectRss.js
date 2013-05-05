var runtimeConfig = require('configure');
var utils = require( './utils' );

exports.feed_title = 'KS2RSS' || runtimeConfig.feed_title;
exports.item_title_prefix = 'Kickstarter: ' || runtimeConfig.item_title_prefix;
exports.item_title_suffix = '' || runtimeConfig.item_title_suffix;

exports.projectToRssXml = function( project ) {
    var d = new Date();
    d.setTime( project.seen );

    var xml = '\t\t<item>\n';
    xml += '\t\t\t<title>' + utils.escapeXml( exports.item_title_prefix + project.name + exports.item_title_suffix ) + '</title>\n';
    xml += '\t\t\t<guid>' + utils.escapeXml( project.url ) + '</guid>\n';
    xml += '\t\t\t<link>' + utils.escapeXml( project.url ) + '</link>\n';
    xml += '\t\t\t<description>' + utils.escapeXml(
        '<a href="' + utils.escapeXml( project.url ) + '"><img src="' + utils.escapeXml( project.thumbnail ) + '" /><br />'
        + '<a href="' + utils.escapeXml( project.url ) + '">' + project.name + '</a><br />'
        + 'By ' + project.author + '</a><br />'
        + '<br />'
        + project.blurb + '<br />'
        + '<br />'
        + '<hr />'
        + '<br />'
        + project.details
    ) + '</description>\n';
    xml += '\t\t\t<pubDate>' + utils.escapeXml( d.toISOString() ) + '</pubDate>\n';
    xml += '\t\t</item>\n';

    return xml;
};

exports.projectsToRssXmlFeed = function( projects ) {
    var xml;

    // Start XML
    xml = '<rss version="2.0">\n';
    xml += '\t<channel>\n';
    xml += '\t\t<title>' + utils.escapeXml( exports.feed_title ) + '</title>\n';
    xml += '\t\t<link>' + utils.escapeXml( runtimeConfig.project_list_base_url ) + '</link>\n';
    xml += '\t\t<description></description>\n';

    // For each project
    projects.forEach( function( project ) {
        xml += exports.projectToRssXml( project );
    } );

    xml += '\t</channel>\n';
    xml += '</rss>\n';

    return xml;
};
