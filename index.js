const hound = require('hound')
var fs = require('fs');
const fse = require('fs-extra')
// Create a directory tree watcher.
var open = require("open");


var destDir;
process.platform === 'win32' ? destDir = process.env.APPDATA + '/Elgato/StreamDeck/Plugins/dev.cidercollective.ciderdeck.sdPlugin' : destDir = process.env.HOMEPATH + '/Library/Application Support/com.elgato.StreamDeck/Plugins/dev.cidercollective.ciderdeck.sdPlugin';
fse.ensureDir(destDir, err => {
    console.log(err) // => null
    // dir has now been created, including the directory it is to be placed in
})
console.log("Watching for changes in src/dev.cidercollective.ciderdeck.sdPlugin")

let watchDir = process.platform == "win32" ? __dirname + `\\src\\dev.cidercollective.ciderdeck.sdPlugin` : "/src/dev.cidercollective.ciderdeck.sdPlugin"
open(watchDir)

fse.copy(watchDir,destDir,{overwrite:true, force: true, recursive: true}, function (err) {
    if (err) return console.error(err)
    console.log("Copied files to Stream Deck")
})

watcher = hound.watch(watchDir);

// Add callbacks for file and directory events.  The change event only applies
// to files.

console.log(__dirname)

fs.watch(watchDir, { persistent: true }, function (event, fileName) {
    console.log("Event: " + event);
    if (fileName.includes("~")) return;
    console.log(fileName + "\n");
    fse.copy(watchDir,destDir,{overwrite:true, force: true, recursive: true}, function (err) {
        if (err) return console.error(err)
        console.log("Copied files to Stream Deck")
    })
});

watcher.on("delete", function (path, stat) {
    let file = String(path).split(watchDir)[1]

    try {
        fs.unlink(destDir + file,(err) => {
            if (err) throw err;
            console.log('successfully deleted ' + file);
        })
    } catch (error) {
        //console.log(error)
    }

})
