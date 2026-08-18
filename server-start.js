// V-TRADE AI canonical Render startup entrypoint.
// Keep the existing production launcher as the implementation so all
// current runtime hotfixes/patches remain active while Render uses one
// explicit startup command.
require('./server-launcher.js');
