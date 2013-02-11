////////////////////////////////////////////////////////////////////////////////
// Modules
////////////////////////////////////////////////////////////////////////////////

var CONFIG = require( './config' );
var events = require('events');
var fs = require( 'fs' );
var http = require( 'http' );
var jquery = require( 'jquery' );
var jsdom = require('jsdom');
var sys = require('sys');

////////////////////////////////////////////////////////////////////////////////
// Debug code to serve sample files
////////////////////////////////////////////////////////////////////////////////

if( CONFIG.TEST_MODE ) {
    (function(){
        var sampleServer = http.createServer();
        sampleServer.listen( CONFIG.TEST_LISTEN_PORT );
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

                if( project.url.substr( 0 , CONFIG.PROJECT_PREFIX.length ) === CONFIG.PROJECT_PREFIX ) {
                    var str = project.url;

                    // Strip off the prefix
                    str = str.substr( CONFIG.PROJECT_PREFIX.length );

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

    if( this.page === CONFIG.PAGE_LIMIT || ! this.pageProjectsCount ) {
        this.emit( 'allPagesLoaded' );
    }

    pageBatchEndsAt = this.page + CONFIG.PAGES_IN_TANDEM;

    if( this.pageProjectsCount && ( null === CONFIG.PAGE_LIMIT || this.page < CONFIG.PAGE_LIMIT ) ) {
        while( ( this.page < pageBatchEndsAt ) && ( null === CONFIG.PAGE_LIMIT || this.page < CONFIG.PAGE_LIMIT ) )
        {
            this.page += 1;
            this.fetch();
        }
    }
};

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

jsdom.defaultDocumentFeatures = {
    FetchExternalResources: [],
    ProcessExternalResources: false
};

var data;

try {
    data = JSON.parse( fs.readFileSync( CONFIG.DATA_FILE ) );
} catch( e ) {
    data = {};
}

data = data || {};
data.stubs = data.stubs || {};
data.projectsByUrl = data.projectsByUrl || {};

var channels = {};
var stub;
for( var stubName in CONFIG.STUBS ) {
    (function( stub , stubName ) {
        var loader = new Loader();
        loader.basePath = CONFIG.BASE_PATH;
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
    })( CONFIG.STUBS[stubName] , stubName );
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
    // If the project was first seen over CONFIG.EXPIRE_THRESHOLD ago, don't
    // generate the item XML
    if( project.seen < Date.now() - CONFIG.EXPIRE_THRESHOLD ) {
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

    project.exported = true;

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

    // Mark all projects as inactive
    for( projectIndex in data.projectsByUrl ) {
        data.projectsByUrl[ projectIndex ].active = false;
        data.projectsByUrl[ projectIndex ].exported = false;
    }

    // For each stub
    totalOnes = 0;
    newOnes = 0;
    for( stubName in CONFIG.STUBS ) {
        stub = CONFIG.STUBS[stubName];

        // Initialize containers/notes if not present
        data.stubs[stubName] = stub;

        // For each project for this stub
        for( projectIndex = 0 ; projectIndex < channels[stub].length ; projectIndex ++ ) {
            project = channels[stub][projectIndex];

            if( data.projectsByUrl[ project.url ] ) { // If we've seen this project before
                // Item XML
                xml += projectXml( data.projectsByUrl[ project.url ] );
            } else { // If we've not seen this project before
                console.log( 'New one: ' + project.name.replace( /\n.*/ , '' ).replace( /^\s+/ , '' ).replace( /\s+$/ , '' ) );

                // Push the project onto the past list
                data.projectsByUrl[ project.url ] = project;

                // Item XML
                xml += projectXml( project );

                // Count it
                newOnes += 1;
            }

            // Mark active
            data.projectsByUrl[ project.url ].active = true;

            // Count it
            totalOnes += 1;
        }
    }

    // Close XML
    xml += '  </channel>\n';
    xml += '</rss>\n';

    // Write results
    fs.writeFileSync( CONFIG.OUT_FILE , xml );
    fs.writeFileSync( CONFIG.DATA_FILE , JSON.stringify( data , null , '\t' ) );

    // Exit cleanly
    if( newOnes ) {
        console.log( 'New projects this round: ' + newOnes );
        console.log( 'Total projects: ' + totalOnes );
    }
    process.exit(0);
}
