// Algorithm:
    // Fetch first page of results
        // Parse HTML
        // If there are entries
            // For each entry link
                // Extract URL
                // Extract Name
                // Extract Blurb
                // Extract Thumbnail
                // Queue fetch of entry page
                    // Extract Content Area
                    // Remove these tags
                        // applet
                        // canvas
                        // embed
                        // input
                        // link
                        // object
                        // script
                        // select
                        // style
                        // textarea
                        // title
                    // Convert these into spans
                        // button
                    // Convert these into plain divs
                        // body
                        // form
                        // head
                        // html
                    // Convert these into links
                        // iframe
                        // frameset
            // Queue fetch of next page
    // Before program exits
        // Author new XML feed
    // On any page fetch failure, simply queue repeat fetch unaltered until successful
// TODO
    // PubSubHubbub integration?
    // Use .NS-projects-content element from project pages
    // RSS post details should have blurb, then <hr>, then full content area
