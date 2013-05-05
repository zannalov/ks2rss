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

    // If the project version doesn't match the software version, then we've
    // changed something and this old data shouldn't be shown/included
    if( project.version != VERSION ) {
        return '';
    }

    var d = new Date();
    d.setTime( project.seen );

    var xml = '    <item>\n';
    xml += '      <title>' + CONFIG.TITLE_PREFIX + utils.escapeXml( project.name ) + '</title>\n';
    xml += '      <guid>' + utils.escapeXml( project.url ) + '</guid>\n';
    xml += '      <link>' + utils.escapeXml( project.url ) + '</link>\n';
    xml += '      <description>' + utils.escapeXml(
        '<a href="' + utils.escapeXml( project.url ) + '"><img src="' + utils.escapeXml( project.thumbnail ) + '" /><br />'
        + '<a href="' + utils.escapeXml( project.url ) + '">' + utils.escapeXml( project.name ) + '</a><br />'
        + 'By ' + utils.escapeXml( project.author ) + '</a><br />'
        + '<br />'
        + utils.escapeXml( project.blurb ) + '<br />'
    ) + '</description>\n';
    xml += '      <pubDate>' + utils.escapeXml( d.toISOString() ) + '</pubDate>\n';
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

    // Exit cleanly
    if( newOnes ) {
        console.log( 'New projects this round: ' + newOnes );
        console.log( 'Total projects: ' + totalOnes );
    }
    process.exit(0);
}
