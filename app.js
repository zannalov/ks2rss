// TODO: Parity:
    // TODO: Configuration loading
    // TODO: Before program exits
        // TODO: Author new XML feed
        // TODO: RSS post details should have blurb, then <hr>, then full content area
// TODO: PubSubHubbub integration?

var STARTED = Date.now();
var fetch = require( './lib/fetch' );
var ch = require('ch').ch;
var fs = require('fs');
var projectDb = require( './lib/projectDb' );
var projectRss = require( './lib/projectRss' );
var runtimeConfig = require('configure');
var SEEN_THRESHOLD;

// Note our start time
console.log( 'KS2RSS Started: ' + STARTED );

// We have to have a config file for the URL format
if( ! runtimeConfig ) {
    throw 'Must have config file';
}
if( ! runtimeConfig.project_list_url_template ) {
    throw 'Config must have project_list_url_template property';
}

// Once the program exits, timestamp the completion
process.on( 'exit' , function() {
    console.log( 'KS2RSS Finished: ' + Date.now() );
} );

// By default, only show the last 24 hours of projects
var SEEN_THRESHOLD = ( 24 * 60 * 60 * 1000 );
if( runtimeConfig.seen_threshold ) {
    SEEN_THRESHOLD = runtimeConfig.seen_threshold;
}

// We must support at least two concurrent file descriptors, or else sqlite and
// network calls will conflict
ch.setMax( runtimeConfig.max_fd_concurrency || 2 );

// Consolidated
var markSeenAndAccept = function( project , eachProjectLoadedCallback , accepted ) {
    var seenRow = {
        url: project.url,
        seen: project.seen,
        base: runtimeConfig.project_list_url_template,
        batch: STARTED
    };

    // Mark that we saw it
    projectDb.markProjectSeen( seenRow , function() {

        // And accept the entry because it's not been
        // seen before
        eachProjectLoadedCallback( accepted );

    } ); // end markProjectSeen
};

// Start by opening the DB connection
projectDb.openDb( function() {

    // Then fetch all the pages for the current config
    fetch.fetchAllProjectListPages( {

        urlTemplate: runtimeConfig.project_list_url_template,

        eachProjectLoaded: function( project , eachProjectLoadedCallback ) {

            // Check if we've seen this project before
            projectDb.projectFirstSeen( project , function( firstSeen ) {

                // If we've seen it before
                if( firstSeen ) {

                    // If it was first seen before X time ago
                    if( firstSeen < Date.now() - SEEN_THRESHOLD ) {

                        markSeenAndAccept( project , eachProjectLoadedCallback , false );

                    // It was seen recently enough
                    } else {

                        // So fetch the original details
                        projectDb.overrideProjectDetails( project , function() {

                            markSeenAndAccept( project , eachProjectLoadedCallback , true );

                        } ); // end overrideProjectDetails

                    } // end firstSeen threshold comparison

                // Otherwise if we've not seen it before
                } else {

                    // Fetch the details of the project
                    fetch.fetchProjectDetails( {
                        project: project,
                        callback: function() {

                            // Store entry
                            projectDb.addProjectEntry( project , function() {

                                markSeenAndAccept( project , eachProjectLoadedCallback , true );

                            } );
                        },
                    } );

                } // end else firstSeen

            } ); // end projectFirstSeen

        }, // end eachProjectLoaded

        allProjectsLoaded: function( projects ) {
            var xml;

            xml = projectRss.projectsToRssXmlFeed( projects );
            fs.writeFileSync( runtimeConfig.feed_file , xml );
            projectDb.closeDb();
        },

    } ); // end fetchAllProjectListPages

} ); // end openDb call
