/*
var fetchPage = require( './lib/fetch' ).fetchPage;
var parseProjectListPage = require( './lib/parse' ).parseProjectListPage;

var url = 'http://www.kickstarter.com/discover/recently-launched?ref=sidebar';

fetchPage({
    url: url,
    maxAttempts: 1,
    extCallback: function( err , body ) {
        if( !err ) {
            var projects = parseProjectListPage( url , body );
            console.log( projects );
        }
    },
});
*/

var Fetch = require( './lib/fetch' );
var ch = require('ch').ch;

ch.setMax( 256 );

Fetch.fetchAllProjectListPages( {
    urlTemplate: 'http://www.kickstarter.com/discover/recently-launched?ref=sidebar&page=%%page%%',

    eachProjectLoaded: function( project , callback ) {
        // console.log( 'project fully loaded:' );
        // console.log( project );
        // console.log( '' );

        // Randomly choose to keep/discard each project
        callback( Boolean( Math.round( Math.random() ) ) );
    },

    allProjectsLoaded: function( projects ) {
        console.log( 'all projects loaded, total = ' + projects.length );
    },
} );
