var jquery = require( 'jquery' );
var jsdom = require('jsdom');
var utils = require('./utils');

exports.parseProjectListPage = function( url , rawBody ) {
    var projects = [];

    var doc = jsdom.jsdom( rawBody , null , {
        FetchExternalResources: [],
        ProcessExternalResources: false,
        url: url
    } );

    var window = doc.createWindow();
    var jq = jquery.create( window );

    var projectsJq = jq( 'li.project' );

    projectsJq.each( function( elIndex , el ) {
        var author;
        var authorSpan;
        var project;
        var projectLink;
        var projectPhoto;

        project = {
            version: utils.VERSION,
            firstSeen: Date.now(),
            url: null,
            name: null,
            author: null,
            thumbnail: null,
            blurb: null,
        };

        projectLink = jq( 'h2 a' , el );
        if( 1 === projectLink.length ) {
            // Grab the HTML properties of the a-href
            project.url = utils.urlCleanup( projectLink.prop( 'href' ) );
            project.name = projectLink.text();
        }

        authorSpan = jq( 'h2 span' , el );
        if( 1 === authorSpan.length ) {
            author = authorSpan.text();
            author = author.replace( /\s+/ , ' ' );
            author = author.replace( /^by / , '' );
            author = utils.whitespace( author );
            project.author = author;
        }

        projectPhoto = jq( '.projectphoto-little' , el );
        if( 1 === projectPhoto.length && projectPhoto.prop( 'src' ) ) {
            project.thumbnail = utils.urlCleanup( projectPhoto.prop( 'src' ) );
        }

        project.blurb = utils.whitespace( jq( '.bbcard_blurb' , el ).text() );

        if( project.url && project.name && project.thumbnail && project.blurb ) {
            projects.push( project );
        }
    } );

    window.close();

    return projects;
};
