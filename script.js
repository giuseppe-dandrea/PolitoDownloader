// ==UserScript==
// @name         PolitoDownloader
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Download all your Polito material in one click
// @author       giuseppe-dandrea
// @match        https://didattica.polito.it/pls/portal30/sviluppo.pagina_corso.main?t=3
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js
// ==/UserScript==

(function() {
	"use strict";

	const URL = "https://didattica.polito.it/pls/portal30/sviluppo.filemgr.handler";
	const COOKIE = document.cookie;

	// List the content of a directory
	// callback(pathList, parentPath, parentZipFolder, downloadAll)
	// pathList contains the objects of the files and dirs
	function listPath(path, code, callback, parentZipFolder, downloadAll) {
		N_FILE++;
		if (path === "/") {
			code = "";
		}
		let params = "?action=list&path=" + encodeURIComponent(path) + "&code=" + code;
		let xhttp = new XMLHttpRequest();

		activeDownloadButton.innerHTML = "Retrieving files...";

		xhttp.open("POST", URL + params);
		xhttp.send();
		xhttp.onreadystatechange = function() {
			if (xhttp.readyState == 4 && xhttp.status == 200) {
				let pathList = JSON.parse(xhttp.responseText);
				pathList = pathList.result.filter(o => o.name !== "ZZZZZZZZZZZZZZZZZZZZLezioni on-line");
				if (pathList.length === 0) {
					return;
				}
				N_FILE--;
				if (callback) callback(pathList, path, parentZipFolder, downloadAll);
			}
		}
	}

	// callback for listPath:
	// for every object in path list:
	//   if the object is a dir: create the dir in the zip and call listFiles in that dir
	//   else download and add the file to the zip
	function listPathHandler(pathList, parentPath, parentFolder, downloadAll) {
		pathList.forEach(o => {
			if (o.type == "dir") {
				// console.log("Created dir " + o.name);
				let newFolder = parentFolder.folder(o.name);
				listPath(parentPath + o.name + "/", o.code, listPathHandler, newFolder, downloadAll);
			} else if (o.type == "file" && (downloadAll || (DOWNLOADED_FILES[o.code] ? o.date > DOWNLOADED_FILES[o.code] : true))) {
				N_FILE++;
				// console.log("Added " + o.name);
				DOWNLOADED_FILES[o.code] = o.date;
				let params = "?action=download&path=" + encodeURIComponent(parentPath + o.name) + "&code=" + o.code;
				let xhttp = new XMLHttpRequest();
				xhttp.open("POST", URL + params);
				xhttp.responseType = "blob";
				xhttp.send();
				xhttp.onreadystatechange = function() {
					if (xhttp.readyState == 4 && xhttp.status == 200) {
						parentFolder.file(o.name, xhttp.response, { binary: true });
						// console.log("1 file added!");
						N_DOWNLOADED++;
						N_FILE--;
					}
				}
			}
		});
	}

	function saveFile(blob, name) {
		let a = document.createElement("a");
		document.body.appendChild(a);
		a.style = "display: none";
		let url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = name;
		a.click();
		window.URL.revokeObjectURL(url);
		a.parentNode.removeChild(a);
	}

	function downloadZip(zip, name) {
		// console.log("Inizio a comprimere!");
		zip.generateAsync({ type:"blob" }).then(function(content) {
			saveFile(content, name);
			activeDownloadButton.innerHTML = activeButtonText;
		});
	}

	function onCompleted(callback) {
		setTimeout(function() {
			if (N_FILE === 0) {
				activeDownloadButton.innerHTML = "Downloading...";
				callback();
			} else {
				onCompleted(callback);
			}
		}, 1000);
	}

	// download all
	let downloadAllButton = document.createElement("button");
	downloadAllButton.innerHTML = "Download All Files";
	downloadAllButton.setAttribute("id", "downloadAllButton");
	downloadAllButton.setAttribute("class", "btn btn-primary");

	// download new
	let downloadNewButton = document.createElement("button");
	downloadNewButton.innerHTML = "Download New Files";
	downloadNewButton.setAttribute("id", "downloadNewButton");
	downloadNewButton.setAttribute("class", "btn btn-primary");
	downloadNewButton.style["margin-left"] = "5px";

	// new badge
	let badge = document.createElement("div");
	badge.style.cssText = `
		background: red;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		position: relative;
		z-index: 1000;
		top: -30px;
		left: 142px;
		margin-bottom: -10px;
		display: none;`
	downloadNewButton.append(badge);

	let lastUpdate = 0;
	setTimeout(function() {
		lastUpdate = Date.parse(document.querySelector("#filemanagerNavbar > div > div.navbar-header > div > span").innerText);
		if (GM_getValue("lastUpdate", 0) < lastUpdate) {
			badge.style.display = "block";
		}
	}, 500);

	// center tag
	let centerTag = document.createElement("center");
	centerTag.appendChild(downloadAllButton);
	centerTag.appendChild(downloadNewButton);
	document.querySelector("#portlet_corso_container > div > div > div.row.text-left > div > div:nth-child(2)").prepend(centerTag);
	// global vars
	let zip;
	let N_FILE;
	let N_DOWNLOADED;
	let DOWNLOADED_FILES;
	let activeDownloadButton;
	let activeButtonText;

	function initGlobals(button) {
		zip = new JSZip();
		N_FILE = 0;
		N_DOWNLOADED = 0;
		DOWNLOADED_FILES = GM_getValue("downloadedFiles", {});
		activeDownloadButton = button;
		activeButtonText = button.innerHTML;
	}

	// download all listener
	document.getElementById("downloadAllButton").onclick = function() {
		initGlobals(downloadAllButton);
		listPath("/", 0, listPathHandler, zip, true);
		let title = document.querySelector("body > div:nth-child(9) > div > div > h2 > strong");
		onCompleted(function() {
			GM_setValue("downloadedFiles", DOWNLOADED_FILES);
			if (N_DOWNLOADED > 0) {
				downloadZip(zip, title.innerHTML);
				badge.style.display = "none";
				GM_setValue("lastUpdate", lastUpdate);
			} else {
				activeDownloadButton.innerHTML = "No files!";
			}
		});
	}

	// download new listener
	document.getElementById("downloadNewButton").onclick = function() {
		initGlobals(downloadNewButton);
		listPath("/", 0, listPathHandler, zip, false);
		let title = document.querySelector("body > div:nth-child(9) > div > div > h2 > strong");
		onCompleted(function() {
			GM_setValue("downloadedFiles", DOWNLOADED_FILES);
			if (N_DOWNLOADED > 0) {
				downloadZip(zip, title.innerHTML);
				badge.style.display = "none";
				GM_setValue("lastUpdate", lastUpdate);
			} else {
				activeDownloadButton.innerHTML = "No new files!";
			} 
		});
	}
})();