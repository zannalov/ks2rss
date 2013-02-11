(function(){
    'use strict';

    // Local variables
    var CONFIG;
    var countActive;
    var countProjectsExpired;
    var countProjectsSeen;
    var countStubs;
    var fs;
    var iterator;
    var pastData;
    var project;

    // Load modules
    CONFIG = require( './config' );
    fs = require( 'fs' );

    // Load data
    pastData = JSON.parse( fs.readFileSync( CONFIG.DATA_FILE ) );

    // Zero counts
    countActive =
    countProjectsExpired =
    countProjectsSeen =
    countStubs =
    0;

    // Count stubs
    for( iterator in pastData.countStubs ) {
        countStubs += 1;
    }

    // Count projects
    for( iterator in pastData.projectsByUrl ) {
        project = pastData.projectsByUrl[ iterator ];
        countProjectsSeen += 1;

        if( project.seen < Date.now() - CONFIG.EXPIRE_THRESHOLD ) {
            countProjectsExpired += 1;
        }

        if( project.active ) {
            countActive += 1;
        }
    }

    console.log( 'Stubs: ' + countStubs );
    console.log( 'Projects seen: ' + countProjectsSeen );
    console.log( 'Projects expired: ' + countProjectsExpired );
    console.log( 'Projects in last fetch (active): ' + countActive );
})();
