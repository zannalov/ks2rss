// var sqlite3 = require( 'sqlite3' ).verbose();
var sqlite3 = require( 'sqlite3' );
var async = require( 'async' );
var ch = require('ch').ch;
var utils = require( './utils' );
var runtimeConfig = require('configure');

var createTables;
var db;
var fdRelease;
var insertRow;
var tables;

exports.DB_FILE = ':memory:';

if( runtimeConfig.projects_db_file ) {
    exports.DB_FILE = runtimeConfig.projects_db_file;
}

tables = {
    project: {
        name: 'projects_' + String(utils.VERSION).replace(/[^a-zA-Z0-9]/g,'_'),
        fields: {
            'url': 'TEXT PRIMARY KEY ON CONFLICT REPLACE',
            'name': 'TEXT',
            'author': 'TEXT',
            'thumbnail': 'TEXT',
            'blurb': 'TEXT',
            'details': 'TEXT',
            '_raw': 'TEXT',
        }
    },
    seen: {
        name: 'seen_' + String(utils.VERSION).replace(/[^a-zA-Z0-9]/g,'_'),
        fields: {
            'url': 'TEXT',
            'seen': 'INTEGER',
            'base': 'TEXT',
            'batch': 'INTEGER',
        }
    },
};

createTables = function( createTablesCallback ) {
    var tableCreateMethods;
    var tableName;

    tableCreateMethods = [];

    // For each table
    for( tableName in tables ) { (function( tableDetails , table ) {

        // Push onto the list
        tableCreateMethods.push(

            // A method for creating the table
            function( stepCallback ) {

                var query;
                var field;
                var firstField;

                query = 'CREATE TABLE IF NOT EXISTS ';
                query += tableDetails.name;
                query += ' ( ';

                firstField = true;
                for( field in tableDetails.fields ) {
                    if( firstField ) {
                        firstField = false;
                    } else {
                        query += ' , ';
                    }

                    query += field + ' ' + tableDetails.fields[ field ];
                }

                query += ' ) ';

                db.run( query , function() {
                    stepCallback( null , null );
                } );

            } // end create method

        ); // end tableCreateMethods.push

    })( tables[ tableName ] , tableName ); } // end foreach tableDetails

    // Run all table creations in parallel
    async.parallel( tableCreateMethods , function() {
        createTablesCallback();
    } );
};

exports.openDb = function( openDbCallback ) {
    ch.queue({
        curryRelease: true,
        callback: function( release ) {
            fdRelease = release;

            db = new sqlite3.cached.Database( exports.DB_FILE , function() {
                createTables( openDbCallback );
            } );
            // db.on( 'trace' , function( query ) {
                // console.log( 'QUERY: ' + query );
            // } );
        },
    });
};

exports.closeDb = function() {
    db.close();
    fdRelease();
};

insertRow = function( tableName , sourceObject , insertRowCallback ) {
    var query;
    var field;
    var firstField;
    var row;

    row = {};

    query = 'INSERT INTO ' + tables[ tableName ].name + ' VALUES ( ';

    firstField = true;
    for( field in tables[ tableName ].fields ) {
        if( firstField ) {
            firstField = false;
        } else {
            query += ' , ';
        }

        query += '$' + field;
        if( '_raw' == field ) {
            row[ '$_raw' ] = JSON.stringify( sourceObject );
        } else {
            row[ '$' + field ] = sourceObject[ field ];
        }
    }

    query += ' ) ';

    db.run( query , row , function( err ) {
        if( err ) {
            throw err;
        }

        insertRowCallback();
    } );
};

exports.addProjectEntry = function( project , addProjectEntryCallback ) {
    insertRow( 'project' , project , addProjectEntryCallback );
};

exports.markProjectSeen = function( row , markProjectSeenCallback ) {
    insertRow( 'seen' , row , markProjectSeenCallback );
};

exports.projectFirstSeen = function( project , projectFirstSeenCallback ) {
    db.get( 'SELECT MIN( seen ) AS seen FROM ' + tables.seen.name + ' WHERE url = $url' , {
        $url: project.url,
    } , function( err , row ) {
        if( err ) {
            console.log( err );
        }

        projectFirstSeenCallback( ( row && row.seen ) || null );
    } );
};

exports.overrideProjectDetails = function( project , overrideProjectDetailsCallback ) {
    db.get( 'SELECT * FROM ' + tables.project.name + ' WHERE url = $url AND version = $version' , {
        $url: project.url,
        $version: utils.VERSION,
    } , function( err , row ) {
        var field; // iterator

        if( err ) {
            console.log( err );
        } else {
            if( row ) {
                if( row._raw ) {
                    row = JSON.parse( row._raw );
                }

                for( field in project ) {
                    delete project[ field ];
                }
                for( field in row ) {
                    project[ field ] = row[ field ];
                }
            }

            overrideProjectDetailsCallback();
        }
    } );
};
