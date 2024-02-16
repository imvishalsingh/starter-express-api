const express = require('express');
const axios = require('axios');
const zlib = require('zlib');
const fs = require('fs');
const tar = require('tar');
const path = require('path');
const sd = require('./stardictUtils.js');
const app = express();
const port = 3000;

const outputDirectory = 'dictOutput';

//var for dict file
var dzfile      = "";
var indfile     = "";
var synfile     = "";

var dictFile    = "";

// Define a route to get the definition of a word
app.get('/getDict', async (req, res) => {

   if(req?.query?.dictPath!="") {
    try {
       
      const response = await axios.get(req?.query?.dictPath, { responseType: 'stream' });
      const tarFilePath = path.join(__dirname, 'dictFile.tar.gz');
      const tarFileWriteStream = fs.createWriteStream(tarFilePath);

      response.data.pipe(tarFileWriteStream);

      await new Promise((resolve, reject) => {
        tarFileWriteStream.on('finish', resolve);
        tarFileWriteStream.on('error', reject);
      });

      await new Promise((resolve, reject) => {
        fs.createReadStream(tarFilePath)
          .pipe(zlib.createGunzip())
          .pipe(tar.x({ cwd: outputDirectory, strict: true }))
          .on('close', resolve)
          .on('error', reject);
      });

      var files = fs.readdirSync(outputDirectory);

      files.forEach(file => {
        let fileStat = fs.statSync(outputDirectory+'/'+file).isDirectory();
        if(!fileStat) {
          if(file.match(/\.(.+)$/)[1]=="dict.dz"){
            dzfile = outputDirectory+'/'+file;
          }
          else if(file.match(/\.(.+)$/)[1]=="idx"){
            indfile = outputDirectory+'/'+file;
          }
          else if(file.match(/\.(.+)$/)[1]=="syn"){
            synfile = outputDirectory+'/'+file;
          }
        }
      });

      const tab1 = sd.getOffsetLengthTable(indfile, synfile);
      const tab2 = sd.getSliceChunksTable(dzfile, tab1);

      files.forEach(file => {
        let fileStat = fs.statSync(outputDirectory+'/'+file).isDirectory();
        if(!fileStat) {
          if(file.match(/\.(.+)$/)[1]!="dict.dz" && file.match(/\.(.+)$/)[1]!="idx" && file.match(/\.(.+)$/)[1]!="syn" && file.match(/\.(.+)$/)[1]!="DS_Store"){
            dictFile = file.split('.')[0];
            fs.unlink(outputDirectory+'/'+file, (err) => {
                if (err) throw err;
                console.log(outputDirectory+'/'+file+' was deleted!');
            }); 
          }
        }
      });

      let tempArr = [];
      // Applying ranges using forEach
      tab2.forEach((item, index) => {
        let tempWordObj = {id: index+1, dictWord: item.slice(",")[0]};
        tempArr.push(tempWordObj);
      });

      res.json({status: true, msg: "", data: { dictName: dictFile, dictWords: tempArr }});

    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).send('Internal Server Error');
    }
  }
});

// Define a route to get the definition of a word
app.get('/getDef', async (req, res) => {
  function removeHtmlTagsAndBreaks(inputString) {
    // Replace <BR> with \n
    let stringWithLineBreaks = inputString.replace(/<BR\s*\/?>/gi, '\n');
    // Remove HTML tags
    let stringWithoutHtml = stringWithLineBreaks.replace(/<[^>]*>/g, '');
    return stringWithoutHtml;
  }
  if(req?.query?.searchWord!="" && req?.query?.dictName!="") {
    try {
      let dictDefination = await sd.getArticleBodyfromDZ3('dictOutput/'+req?.query?.dictName+'.dict.dz', req?.query?.searchWord, false);
      //removeHtmlTagsAndBreaks(dictDefination)
      res.json({status: true, msg: "", data: dictDefination});
    } catch (error) {
      console.error('Error 123:', error.message);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})