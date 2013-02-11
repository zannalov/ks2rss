////////////////////////////////////////////////////////////////////////////////
// Modules
////////////////////////////////////////////////////////////////////////////////

var events = require('events');
var fs = require( 'fs' );
var http = require( 'http' );
var jquery = require( 'jquery' );
var jsdom = require('jsdom');
var sys = require('sys');

////////////////////////////////////////////////////////////////////////////////
// Config
////////////////////////////////////////////////////////////////////////////////

var pageLimit = null; // Max pages to load per stub
var pagesInTandem = 15; // Remember, multiply this by the number of stubs below for true number of tandem connections
var EXPIRE_THRESHOLD = ( 24 * 60 * 60 * 1000 ); // Milliseconds
var dataFile = 'projectsSeen5.json';
var outFile = 'ks2rss5.xml';
var testMode = false;
var basePath = 'http://www.kickstarter.com';
var projectPrefix = 'http://www.kickstarter.com/projects/';
var stubs = {
    'Recently Launched': '/discover/recently-launched',
    'Ending Soon': '/discover/ending-soon',
    //'Recommended': '/discover/recommended',
    //'Small Projects': '/discover/small-projects',
    //'Comics (Popular)': '/discover/categories/comics/popular',
    //'Comics (Recommended)': '/discover/categories/comics/recommended',
    //'Product Design (Popular)': '/discover/categories/product%20design/popular',
    //'Product Design (Recommended)': '/discover/categories/product%20design/recommended',
    //'Animation (Popular)': '/discover/categories/animation/popular',
    //'Animation (Recommended)': '/discover/categories/animation/recommended',
    //'Short Film (Popular)': '/discover/categories/short%20film/popular',
    //'Short Film (Recommended)': '/discover/categories/short%20film/recommended',
    //'Web Series (Popular)': '/discover/categories/webseries/popular',
    //'Web Series (Recommended)': '/discover/categories/webseries/recommended',
    //'Video Games (Popular)': '/discover/categories/video%20games/popular',
    //'Video Games (Recommended)': '/discover/categories/video%20games/recommended',
    //'Electronic Music (Popular)': '/discover/categories/electronic%20music/popular',
    //'Electronic Music (Recommended)': '/discover/categories/electronic%20music/recommended',
    //'Indie Rock (Popular)': '/discover/categories/indie%20rock/popular',
    //'Indie Rock (Recommended)': '/discover/categories/indie%20rock/recommended',
    //'Pop (Popular)': '/discover/categories/pop/popular',
    //'Pop (Recommended)': '/discover/categories/pop/recommended',
    //'Fiction (Popular)': '/discover/categories/fiction/popular',
    //'Fiction (Recommended)': '/discover/categories/fiction/recommended',
    //'Technology Hardware (Popular)': '/discover/categories/hardware/popular',
    //'Technology Hardware (Recommended)': '/discover/categories/hardware/recommended',
    //'Open Software (Popular)': '/discover/categories/open%20software/popular',
    //'Open Software (Recommended)': '/discover/categories/open%20software/recommended',
};

jsdom.defaultDocumentFeatures = {
    FetchExternalResources: [],
    ProcessExternalResources: false
};

////////////////////////////////////////////////////////////////////////////////
// Debug code to serve sample files
////////////////////////////////////////////////////////////////////////////////

if( testMode ) {
    (function(){
        var sampleServer = http.createServer();
        sampleServer.listen( 8000 );
        sampleServer.on( 'request' , function( req , res ) {
            if( '/samples/' == req.url.substr( 0 , 9 ) ) {
                fs.readFile( '.' + req.url , function( err , data ) {
                    if( err ) {
                        res.writeHead( 500 );
                        res.end( String( err ) );
                    } else {
                        res.writeHead( 200 );
                        res.end( data );
                    }
                } );
            } else {
                res.writeHead( 400 );
                res.end( 'Bad request' );
            }
        } );

        basePath = 'http://localhost:8000/samples';
        stubs = {
            'Recommended': '/discover/recommended',
            'Ending Soon': '/discover/ending-soon',
        };
    })();
}

////////////////////////////////////////////////////////////////////////////////
// Fetch a single page
////////////////////////////////////////////////////////////////////////////////

function Loader() {
    this.fetch = this.fetch.bind( this );
    this.fetchPage = this.fetchPage.bind( this );

    this.projects = [];
    this.pagesLoaded = {};

    events.EventEmitter.call( this );

    this.on( 'pageProjectsLoaded', this.fetchNextPages );

    return this;
}
sys.inherits( Loader , events.EventEmitter );

Loader.prototype.basePath = null;
Loader.prototype.stub = null;
Loader.prototype.page = 0;
Loader.prototype.pageProjectsCount = null;

// url must be fully qualified
// callback( err , data )
Loader.prototype.fetchPage = function( url , callback ) {
    var req = http.request( url , function( res ) {
        // If the status code is outside the 200 range
        if( 200 > res.statusCode || 299 < res.statusCode ) {
            if( callback ) {
                callback( 'Status: ' + res.statusCode , null );
                callback = null;
            }

            return;
        }

        var body = '';
        res.setEncoding( 'utf8' );
        res.on( 'data' , function( chunk ) {
            body += chunk;
        }.bind( this ) );
        res.on( 'end' , function() {
            if( callback ) {
                callback( null , body );
                callback = null;
            }
        }.bind( this ) );
    }.bind( this ) );
    req.on( 'error' , function( e ) {
        if( callback ) {
            callback( e , null );
            callback = null;
        }
    }.bind( this ) );
    req.end();
};

Loader.prototype.fetch = function() {
    var page = this.page;
    this.pagesLoaded[ page ] = false;
    this.fullUrl = this.basePath + this.stub + '?page=' + page;
    this.fetchPage( this.fullUrl , function( err , data ) {
        var parsedProjects = [];

        if( err ) {
            console.log( 'Error loading (' + this.fullUrl + '): ' + err );
            this.emit( 'pageProjectsLoaded' , parsedProjects , page );
            return;
        }

        var doc = jsdom.jsdom( data );
        var window = doc.createWindow();
        var jq = jquery.create( window );

        var projectsJq = jq( 'li.project' );
        projectsJq.each( function( index , item ) {
            var project = {};

            project.seen = (new Date()).getTime();

            var projectLink = jq( 'h2 a' , item );
            if( projectLink.length ) {
                project.url = projectLink.prop( 'href' );
                project.name = projectLink.text();

                // Strip out query parameters
                if( -1 !== project.url.indexOf( '?' ) ) {
                    project.url = project.url.substr( 0 , project.url.indexOf( '?' ) );
                }

                // Convert https to http
                if( 'https' === project.url.substr( 0 , 5 ) ) {
                    project.url = 'http' + project.url.substr( 5 );
                }

                if( project.url.substr( 0 , projectPrefix.length ) === projectPrefix ) {
                    var str = project.url;

                    // Strip off the prefix
                    str = str.substr( projectPrefix.length );

                    // Strip out query parameters
                    if( -1 !== str.indexOf( '?' ) ) {
                        str = str.substr( 0 , str.indexOf( '?' ) );
                    }

                    // Split on the first slash
                    str = str.split( '/' )[0];

                    project.creatorId = str;
                }
            }

            var authorSpan = jq( 'h2 span' , item );
            if( authorSpan.length ) {
                var author = authorSpan.text();
                author = author.replace( /^\s+/ , '' );
                author = author.replace( /\s+$/ , '' );
                author = author.replace( /\n/ , ' ' );
                author = author.replace( /\s+/ , ' ' );
                if( /^by /.test( author ) ) {
                    author = author.replace( /^by / , '' );
                    project.creatorName = author;
                }
            }

            var projectPhoto = jq( '.projectphoto-little' , item );
            if( projectPhoto.length && projectPhoto.prop( 'src' ) ) {
                project.thumbnail = projectPhoto.prop( 'src' );

                // Convert https to http
                if( 'https' === project.thumbnail.substr( 0 , 5 ) ) {
                    project.thumbnail = 'http' + project.thumbnail.substr( 5 );
                }
            }

            project.blurb = jq( '.bbcard_blurb' , item ).text();

            if( project.url && project.name && project.thumbnail && project.blurb ) {
                parsedProjects.push( project );
                this.projects.push( project );
            }
        }.bind( this ) );

        //console.log( this.stub + ' page ' + page + ' loaded with ' + parsedProjects.length + ' projects' );
        this.pagesLoaded[ page ] = true;
        this.emit( 'pageProjectsLoaded' , parsedProjects , page );
    }.bind( this ) );
};

Loader.prototype.fetchNextPages = function( parsedProjects , page ) {
    var iterator;
    var pageBatchEndsAt;

    if( page == this.page ) {
        this.pageProjectsCount = parsedProjects.length;
    }

    // If the current batch hasn't finished, skip it
    for( iterator in this.pagesLoaded ) {
        if( ! this.pagesLoaded[ iterator ] ) {
            return;
        }
    }

    if( this.page === pageLimit || ! this.pageProjectsCount ) {
        this.emit( 'allPagesLoaded' );
    }

    pageBatchEndsAt = this.page + pagesInTandem;

    if( this.pageProjectsCount && ( null === pageLimit || this.page < pageLimit ) ) {
        while( ( this.page < pageBatchEndsAt ) && ( null === pageLimit || this.page < pageLimit ) )
        {
            this.page += 1;
            this.fetch();
        }
    }
};

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

var pastData;

try {
    pastData = JSON.parse( fs.readFileSync( dataFile ) );
} catch( e ) {
    pastData = {};
}

pastData = pastData || {};
pastData.stubs = pastData.stubs || {};
pastData.projectsByUrl = pastData.projectsByUrl || {};

var channels = {};
var stub;
for( var stubName in stubs ) {
    (function( stub , stubName ) {
        var loader = new Loader();
        loader.basePath = basePath;
        loader.stub = stub;
        loader.page = 1;
        loader.fetch();
        loader.on( 'allPagesLoaded' , function() {
            //console.log( stub + ' successfully parsed ' + loader.projects.length + ' projects' );
            channels[stub] = loader.projects;
            if( allChannelsLoaded() ) {
                produceXml();
            }
        } );
        channels[stub] = null;
    })( stubs[stubName] , stubName );
}

function allChannelsLoaded() {
    for( var x in channels ) {
        if( null === channels[x] ) {
            return false;
        }
    }

    return true;
}

function escapeXml( str ) {
    // &#....;
    return str.replace( /[^A-Za-z0-9 :;\/\\.?=!$%()*+,@\[\]^_{}"'-]/g, function( m ) {
        return '&#x' + m.charCodeAt(0).toString(16).toUpperCase() + ';';
    } );
}

function projectXml( project ) {
    // If the project was first seen over EXPIRE_THRESHOLD ago, don't
    // generate the item XML
    if( project.seen < Date.now() - EXPIRE_THRESHOLD ) {
        return '';
    }

    var d = new Date();
    d.setTime( project.seen );

    var xml = '    <item>\n';
    xml += '      <title>Kickstarter: ' + escapeXml( project.name ) + '</title>\n';
    xml += '      <guid>' + escapeXml( project.url ) + '</guid>\n';
    xml += '      <link>' + escapeXml( project.url ) + '</link>\n';
    xml += '      <description>' + escapeXml(
        '<a href="' + escapeXml( project.url ) + '"><img src="' + escapeXml( project.thumbnail ) + '" /><br />'
        + '<a href="' + escapeXml( project.url ) + '">' + escapeXml( project.name ) + '</a><br />'
        + 'By ' + escapeXml( project.creatorName ) + '</a><br />'
        + '<br />'
        + escapeXml( project.blurb ) + '<br />'
    ) + '</description>\n';
    xml += '      <pubDate>' + escapeXml( d.toISOString() ) + '</pubDate>\n';
    xml += '    </item>\n';

    return xml;
}

function produceXml() {
    var totalOnes;
    var newOnes;
    var project;
    var projectIndex;
    var stub;
    var stubName;
    var xml;

    // Start XML
    xml = '<rss version="2.0">\n';
    xml += '  <channel>\n';
    xml += '    <title>KS2RSS</title>\n';
    xml += '    <link>http://www.kickstarter.com</link>\n';
    xml += '    <description></description>\n';

    // For each stub
    totalOnes = 0;
    newOnes = 0;
    for( stubName in stubs ) {
        stub = stubs[stubName];

        // Initialize containers/notes if not present
        pastData.stubs[stubName] = stub;

        // For each project for this stub
        for( projectIndex = 0 ; projectIndex < channels[stub].length ; projectIndex ++ ) {
            project = channels[stub][projectIndex];

            if( pastData.projectsByUrl[ project.url ] ) { // If we've seen this project before
                // Item XML
                xml += projectXml( pastData.projectsByUrl[ project.url ] );
            } else { // If we've not seen this project before
                console.log( 'New one: ' + project.name.replace( /\n.*/ , '' ).replace( /^\s+/ , '' ).replace( /\s+$/ , '' ) );

                // Push the project onto the past list
                pastData.projectsByUrl[ project.url ] = project;

                // Item XML
                xml += projectXml( project );

                // Count it
                newOnes += 1;
            }

            // Count it
            totalOnes += 1;
        }
    }

    // Close XML
    xml += '  </channel>\n';
    xml += '</rss>\n';

    // Write results
    fs.writeFileSync( outFile , xml );
    fs.writeFileSync( dataFile , JSON.stringify( pastData , null , '\t' ) );

    // Exit cleanly
    if( newOnes ) {
        console.log( 'New projects this round: ' + newOnes );
        console.log( 'Total projects: ' + totalOnes );
    }
    process.exit(0);
}
