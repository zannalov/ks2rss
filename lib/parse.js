var jquery = require( 'jquery' );
var jsdom = require('jsdom');
var utils = require('./utils');

exports.parseProjectListPage = function( url , rawBody , callback ) {
    var projects = [];

    jsdom.env({
        html: rawBody, 
        url: url,
        done: function( errors , window ) {
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
                    project.url = utils.urlCleanup( projectLink.prop( 'href' ) , url );
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
                    project.thumbnail = utils.urlCleanup( projectPhoto.prop( 'src' ) , url );
                }

                project.blurb = utils.whitespace( jq( '.bbcard_blurb' , el ).text() );

                if( project.url && project.name && project.thumbnail && project.blurb ) {
                    projects.push( project );
                }
            } );

            // We have to defer setTimeout because window.close() will
            // sometimes cause a segfault due to contextify firing our done()
            // callback before everything is really done and ready, but
            // deferring to the end of the call stack seems to be sufficient
            setTimeout( function() {
                window.close();
                callback( projects );
            } , 1 );
        },
    });
};
