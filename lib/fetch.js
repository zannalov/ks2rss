var events = require('events');
var http = require( 'http' );
var https = require( 'https' );
var ch = require('ch').ch;
var Promise = require('promised-io/promise');
var Parse = require('./parse');

exports.MAX_ATTEMPTS = 3;
exports.CATEGORY = undefined;
exports.FETCH_ALL_PROJECT_LIST_PAGES_BATCH_SIZE = 15;

// url: string
// extCallback: function( err , body )
// maxAttempts: count
// category: string
exports.fetchPage = function( config , attemptNumber ) {
    var method;
    var retry;

    // Determine request method
    if( 'https://' === config.url.substr( 0 , 8 ) ) {
        method = https;
    } else if( 'http://' === config.url.substr( 0 , 7 ) ) {
        method = http;
    } else {
        throw 'Unknown method for URL: ' + config.url;
    }

    // Init
    attemptNumber = attemptNumber || 0;
    config.maxAttempts = config.maxAttempts || exports.MAX_ATTEMPTS;
    config.category = config.category || exports.CATEGORY;

    // Generic error handler
    retry = function( error ) {
        var shouldRetry = ( attemptNumber + 1 < config.maxAttempts );

        console.log(
            'Error fetching: ' + config.url + '\n'
            + '    Details: ' + JSON.stringify(error).replace(/\n/,'\n        ') + '\n'
            + '    Status: ' + ( shouldRetry ? ' retrying' : 'giving up' )
        );

        if( shouldRetry ) {
            exports.fetchPage( config , attemptNumber + 1 );
        } else {
            if( config.extCallback ) {
                config.extCallback( error , null );
                config.extCallback = null;
            }
        }
    };

    // Queue network call (using default category)
    ch.queue({
        category: config.category,
        curryRelease: true,
        callback: function( release ) {
            // Build the request and response handler
            var req = method.request( config.url , function( res ) {
                // If the status code is outside the 200 range
                if( 200 > res.statusCode || 299 < res.statusCode ) {
                    retry( 'Status: ' + res.statusCode );
                    release();
                    return;
                }

                // Gather the entire body first
                var body = '';
                res.setEncoding( 'utf8' );
                res.on( 'data' , function( chunk ) {
                    body += chunk;
                } );

                // Pass the body to the config.extCallback
                res.on( 'end' , function() {
                    if( config.extCallback ) {
                        console.log( 'Fetched: ' + config.url );
                        config.extCallback( null , body );
                        config.extCallback = null;
                        release();
                    }
                } );
            } );

            // If there's an error connecting / performing DNS lookup / etc
            req.on( 'error' , function( error ) {
                retry( error );
                release();
            } );

            // Send no body
            req.end();
        },
    });
};

// REQUIRED config.urlTemplate: String with %%pageNumber%% embedded
// REQUIRED config.allProjectsLoaded: Function to call when all pages loaded
// OPTIONAL config.eachProjectLoaded: Function to call with each project as it finishes loading
// OPTIONAL config.fetchAllProjectListPagesBatchSize: Number of pages to attempt to fetch simultaneously
exports.fetchAllProjectListPages = function( config ) {
    var allPagesLoaded;
    var countRawProjects;
    var currentBatchIndex;
    var fetchBatch;
    var fetchDeferredProjectListPage;
    var onAllPagesLoaded;
    var projects;
    var projectsProcessing;

    projects = [];
    projectsProcessing = 0;
    countRawProjects = 0;
    allPagesLoaded = false;
    currentBatchIndex = 0;
    config.fetchAllProjectListPagesBatchSize = config.fetchAllProjectListPagesBatchSize || exports.FETCH_ALL_PROJECT_LIST_PAGES_BATCH_SIZE;

    fetchDeferredProjectListPage = function( url ) {
        var deferred = Promise.defer();

        exports.fetchPage({
            url: url,
            extCallback: function( err , body ) {
                if( err ) {
                    deferred.reject( err );
                } else {
                    Parse.parseProjectListPage( url , body , function( pageProjects ) {
                        deferred.resolve( pageProjects );
                    } );
                }
            },
        });

        return deferred.promise;
    };

    onAllPagesLoaded = function() {
        if( allPagesLoaded && ! projectsProcessing ) {
            config.allProjectsLoaded( projects );
        }
    };

    fetchBatch = function() {
        var fetchPagePromises;
        var pageIndex;
        var batchBeginsOnIndex;
        var batchEndsOnIndex;

        fetchPagePromises = [];
        batchBeginsOnIndex = currentBatchIndex * config.fetchAllProjectListPagesBatchSize;
        batchEndsOnIndex = batchBeginsOnIndex + config.fetchAllProjectListPagesBatchSize;

        // Queue all page loads for this batch
        for( pageIndex = batchBeginsOnIndex ; pageIndex < batchEndsOnIndex ; pageIndex += 1 ) {
            fetchPagePromises.push(
                fetchDeferredProjectListPage( 
                    config.urlTemplate.replace( '%%page%%' , String( pageIndex + 1 ) )
                )
            );
        }

        // When all page loads are complete
        Promise.all( fetchPagePromises ).then(
            // Success
            function( promiseResults ) {

                var projectsThisBatch;

                // Convert arguments into array
                promiseResults = Array.prototype.slice.call( promiseResults );

                // Prepare to store all individual projects
                projectsThisBatch = [];

                // For each page
                promiseResults.forEach( function( projectList , index , list ) {
                    // Convert arguments into array
                    list[ index ] = projectList = Array.prototype.slice.call( projectList );

                    console.log( 'Page ' + ( batchBeginsOnIndex + 1 + index ) + ' loaded ' + projectList.length + ' raw projects' );

                    // Add to the batch list
                    projectsThisBatch = projectsThisBatch.concat( projectList );
                } );

                console.log( 'Total of ' + projectsThisBatch.length + ' raw projects for this batch' );
                countRawProjects += projectsThisBatch.length;

                // If the last page in the batch had results, more batches are
                // needed
                if( promiseResults[ promiseResults.length - 1 ].length ) {
                    // Kick off the next batch fetch
                    currentBatchIndex += 1;
                    fetchBatch();
                } else {
                    // This was the last batch
                    allPagesLoaded = true;
                    console.log( 'Grand total of ' + countRawProjects + ' raw projects' );
                }

                // Assume that we're going to have additional async processing
                // for each project
                projectsProcessing += projectsThisBatch.length;

                // For each project
                projectsThisBatch.forEach( function( project , index ) {
                    var callbackRun = false;

                    // If a callback was provided
                    if( config.eachProjectLoaded ) {

                        // Call the user's callback
                        config.eachProjectLoaded( project , function( keep ) {

                            // If they try to call us more than once, only use
                            // the first call
                            if( callbackRun ) {
                                return;
                            }

                            // Mark this project as processed
                            projectsProcessing -= 1;

                            // If the project was accepted, add it to the
                            // master list
                            if( keep ) {
                                projects.push( project );
                            }

                            // Check to see if this is the last lingering
                            // project
                            onAllPagesLoaded();

                            // Mark this project handled
                            callbackRun = true;

                        } ); // end user's callback

                    // No callback provided
                    } else {

                        // Treat the project as accepted
                        projects.push( project );
                        projectsProcessing -= 1;

                    }
                } );

                // In case no callbacks were needed and this was the last
                // batch, just run this once here
                onAllPagesLoaded();

            } // end success

            // Failure
            , function( failedPromise ) {
                throw 'Promise failed, giving up: ' + failedPromise;
            }
        );
    }; // end fetchBatch

    fetchBatch();
}; // end fetchAllProjectListPages
