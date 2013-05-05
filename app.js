// TODO: Parity:
    // TODO: Configuration loading
    // TODO: Before program exits
        // TODO: Author new XML feed
        // TODO: RSS post details should have blurb, then <hr>, then full content area
// TODO: PubSubHubbub integration?

// Technically the var calls get hoisted above this line, but this needs to be
// run first and I still want to use the var x = require syntax
console.log( 'KS2RSS Started: ' + Date.now() );

var fetch = require( './lib/fetch' );
var ch = require('ch').ch;
var projectsDb = require( './lib/projects' );
var runtimeConfig = require('configure');

var SEEN_THRESHOLD;

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

// Start by opening the DB connection
projectsDb.openDb( function() {

    // Then fetch all the pages for the current config
    fetch.fetchAllProjectListPages( {

        urlTemplate: runtimeConfig.project_list_url_template,

        eachProjectLoaded: function( project , eachProjectLoadedCallback ) {

            // Check if we've seen this project before
            projectsDb.projectFirstSeen( project , function( firstSeen ) {

                // If we've seen it before
                if( firstSeen ) {

                    // If it was first seen before X time ago
                    if( firstSeen < Date.now() - SEEN_THRESHOLD ) {

                        // Just reject it outright
                        eachProjectLoadedCallback( false );

                    // It was seen recently enough
                    } else {

                        // So fetch the original details
                        projectsDb.overrideProjectDetails( project , function() {

                            // Mark that we saw it again
                            projectsDb.markProjectSeen( project , function() {

                                // And accept it for this round
                                eachProjectLoadedCallback( true );

                            } ); // end markProjectSeen

                        } ); // end overrideProjectDetails

                    } // end firstSeen threshold comparison

                // Otherwise if we've not seen it before
                } else {

                    // Fetch the details of the project
                    fetch.fetchProjectDetails( {
                        project: project,
                        callback: function() {

                            // Store entry
                            projectsDb.addProjectEntry( project , function() {

                                // Mark that we saw it
                                projectsDb.markProjectSeen( project , function() {

                                    // And accept the entry because it's not been
                                    // seen before
                                    eachProjectLoadedCallback( true );

                                } ); // end markProjectSeen

                            } );
                        },
                    } );

                } // end else firstSeen

            } ); // end projectFirstSeen

        }, // end eachProjectLoaded

        allProjectsLoaded: function( projects ) {
            console.log( 'all projects loaded, kept total = ' + projects.length );
            projectsDb.closeDb();
        },

    } ); // end fetchAllProjectListPages

} ); // end openDb call
