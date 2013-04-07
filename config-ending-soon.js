exports.PAGE_LIMIT = null; // Max pages to load per stub
exports.PAGES_IN_TANDEM = 5; // Remember, multiply this by the number of stubs below for true number of tandem connections
exports.ATTEMPTS_PER_PAGE = 5;
exports.RETRY_DELAY = 3000;
exports.EXPIRE_THRESHOLD = ( 24 * 60 * 60 * 1000 ); // Milliseconds
exports.DATA_FILE = 'projectsSeen5-ending-soon.json';
exports.OUT_FILE = 'ks2rss5-ending-soon.xml';
exports.TEST_MODE = false;
exports.BASE_PATH = 'http://www.kickstarter.com';
exports.PROJECT_PREFIX = 'http://www.kickstarter.com/projects/';
exports.STUBS = {
    'Ending Soon': '/discover/ending-soon',
};
exports.TITLE_PREFIX = 'Kickstarter: Ending Soon: ';
