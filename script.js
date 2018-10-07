// ==UserScript==
// @name         PolitoDownloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Download all your Polito material in one click
// @author       giuseppe-dandrea
// @match        https://didattica.polito.it/pls/portal30/sviluppo.pagina_corso.main*
// @grant        GM_openInTab
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    var url = 'https://didattica.polito.it/pls/portal30/sviluppo.filemgr.handler';
    var COOKIE = document.cookie;

    // List the content of a directory
    // callback( pathList , parentPath , parentZipFolder )
    //        pathList contains the objects of the files and dirs
    var listPath = function( path , code , callback , parentZipFolder) {
        if (path === '/') {
            code = '';
        }
        var params = '?action=list&path=' + encodeURIComponent(path) + '&code=' + code;
        var xhttp = new XMLHttpRequest();

        downloadButtonWrapper.innerHTML = "Retrieving files...";

        xhttp.open('POST', url + params);
        xhttp.send();
        xhttp.onreadystatechange=function(){
            if ( xhttp.readyState == 4 && xhttp.status == 200 ) {
                var pathList = JSON.parse(xhttp.responseText);
                pathList = pathList.result.filter(o => o.name !== 'ZZZZZZZZZZZZZZZZZZZZLezioni on-line');
                if (pathList.length === 0) {
                    downloadButtonWrapper.innerHTML = "No files!";
                    N_FILE = -1;
                    return;
                }
                if (callback) callback(pathList, path, parentZipFolder);
            }
        }
    }

    // callback for listPath:
    // for every object in path list:
    //      if the object is a dir: create the dir in the zip and call listFiles in that dir
    //      else download and add the file to the zip
    var listPathHandler = function( pathList , parentPath , parentFolder ) {
        downloadButtonWrapper.innerHTML = "Compressing files...";
        pathList.forEach(o => {
            if (o.type == "dir") {
                // console.log("Created dir " + o.name);
                N_FILE++;
                var newFolder = parentFolder.folder(o.name);
                listPath(parentPath + o.name + '/', o.code, listPathHandler, newFolder);
                N_FILE--;
            }
            else if (o.type == "file") {
                N_FILE++;
                // console.log('Added ' + o.name);
                var params = '?action=download&path=' + encodeURIComponent(parentPath + o.name) + '&code=' + o.code;
                let xhttp = new XMLHttpRequest();
                xhttp.open('POST', url + params);
                xhttp.responseType = "blob";
                xhttp.send();
                xhttp.onreadystatechange=function(){
                    if ( xhttp.readyState == 4 && xhttp.status == 200 ) {
                        parentFolder.file(o.name, xhttp.response, { binary: true});
                        // console.log('1 file added!');
                        N_FILE--;
                    }
                }
            }
        });
    }

    function downloadZip() {
        // console.log("Inizio a comprimere!");
        zip.generateAsync({type:"blob"}).then(function( content ) {
            var url = window.URL.createObjectURL(content);
            GM_openInTab(url);
            downloadButtonWrapper.innerHTML = "Download full ZIP";
        });
    }

    function onCompleted(callback) {
        new Promise((resolve) => setTimeout(resolve, 5000)).then(() => {
                if (N_FILE === 0){
                    downloadButtonWrapper.innerHTML = "Downloading...";
                    callback();
                }
                else if (N_FILE === -1) {
                    return;
                }
                else {
                    onCompleted(callback);
                }
            });
    }

    // Creating download tag
    var downloadButton = document.createElement('a');
    var downloadButtonWrapper = document.createElement('button');
    var title = document.querySelector('body > div:nth-child(9) > div > div > h2 > strong');
    downloadButton.setAttribute('download', title.innerHTML + '.zip');
    downloadButtonWrapper.innerHTML = "Download full ZIP";
    downloadButtonWrapper.setAttribute('id', "downloadZipButton");
    downloadButtonWrapper.setAttribute('class', 'btn btn-primary');
    downloadButtonWrapper.appendChild(downloadButton);
    var centerTag = document.createElement('center');
    centerTag.appendChild(downloadButtonWrapper);
    document.querySelector('#portlet_corso_container > div > div > div.row.text-left > div > div:nth-child(2)').prepend(centerTag);
    var zip = new JSZip();
    var N_FILE = 0;

    document.getElementById('downloadZipButton').onclick = function() {
        listPath('/', 0, listPathHandler, zip);
        onCompleted(downloadZip);
    }
})();