(function(){
    'use strict';

    // Local variables
    var CONFIG;
    var countActive;
    var countProjectsExpired;
    var countProjectsExported;
    var countProjectsSeen;
    var countStubs;
    var data;
    var fs;
    var iterator;
    var project;

    // Load modules
    CONFIG = require( './config' );
    fs = require( 'fs' );

    // Load data
    data = JSON.parse( fs.readFileSync( CONFIG.DATA_FILE ) );

    // Zero counts
    countActive =
    countProjectsExpired =
    countProjectsExported =
    countProjectsSeen =
    countStubs =
    0;

    // Count stubs
    for( iterator in data.stubs ) {
        countStubs += 1;
    }

    // Count projects
    for( iterator in data.projectsByUrl ) {
        project = data.projectsByUrl[ iterator ];
        countProjectsSeen += 1;

        if( project.seen < Date.now() - CONFIG.EXPIRE_THRESHOLD ) {
            countProjectsExpired += 1;
        }

        if( project.exported ) {
            countProjectsExported += 1;
        }

        if( project.active ) {
            countActive += 1;
        }
    }

    console.log( 'Stubs: ' + countStubs );
    console.log( 'Projects seen: ' + countProjectsSeen );
    console.log( 'Projects expired: ' + countProjectsExpired );
    console.log( 'Projects in last fetch (active): ' + countActive );
    console.log( 'Projects exported (active - expired): ' + countProjectsExported );
})();
