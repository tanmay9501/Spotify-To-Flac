'use strict'

let cheerio = require('cheerio')
	, cheerioAdv = require('cheerio-advanced-selectors')
	, request = require('request-promise-native')
	, fs = require('fs')
	, stringSimilarity = require('string-similarity')
	, ProgressBar = require('progress')
	, http = require('http');

cheerio = cheerioAdv.wrap(cheerio);

module.exports = class Scraper {
	constructor({ authors: songAuthors, name: songName, album: songAlbum, length: songLength }, multiProgress) {
		this.authors = songAuthors;
		this.name = songName;
		this.album = songAlbum;
		this.length = songLength;
		this.query = `${songName}-${songAuthors.join('-')}`.replace(' ', '-');
		this.songData = [];
		this.multiProgress = multiProgress;
	}

	start() {
		return request('http://search.chiasenhac.vn/search.php?s=' + this.query)
			.then(htmlString => {
				this.processSearch(htmlString);
				this.downloadSong();
			})
			.catch(err => { console.log(err) });
	}

	processSearch(htmlString) {
		const $ = cheerio.load(htmlString);

		// Go through ever row
		$('.tbtable:first tbody').find('tr:not(:first-child)').each((i, elem) => {
			this.songData.push(this.processRow($, elem));
		});
	}

	processRow($, elem) {
		let songData = {};

		// Check every cell
		$(elem).find('td div.tenbh').each((i, elem2) => {
			songData = { ...this.getSongTitle($, elem2), ...songData };
		});

		$(elem).find('td span.gen').each((i, elem2) => {
			let songTime = elem2.children[0].data.split(':');
			songData.time = songTime.reduce((prev, val, i, arr) => {
				if (i == 1) prev = +prev * 60 ** (arr.length - 1);
				return prev += +val * 60 ** (arr.length - i - 1);
			});
		});

		return songData;
	}

	getSongTitle($, elem) {
		let songInfo = {};

		$(elem).find('p').each((i, elem2) => {
			if (i == 0) {
				songInfo.name = elem2.children[0].children[0].data;
				songInfo.url = elem2.children[0].attribs.href.replace('.html', '_download.html'); // Possible better alternative?
			}
			else songInfo.authors = elem2.children[0].data.split('; ');
		});

		return songInfo;
	}

	downloadSong() {
		let downloadInfo;
		return request(this.getBestMatch().url)
			.then(htmlString => {
				downloadInfo = this.getDownloadLink(htmlString);

				let file = fs.createWriteStream(`${this.name} - ${this.authors.join(', ')}.${downloadInfo.format}`)

				let req = http.request(downloadInfo.url, (res) => {
					res.pipe(file);
				});

				req.on('response', res => {
					var len = parseInt(res.headers['content-length'], 10);

					var bar = this.multiProgress.newBar(` :percent :etas [:bar] ${this.name}`, {
						complete: '=',
						incomplete: ' ',
						width: 20,
						total: len
					});

					res.on('data', function (chunk) {
						bar.tick(chunk.length);
					});

					res.on('end', () => bar.terminate());
				});

				req.end();
			});
	}

	getDownloadLink(htmlString) {
		const $ = cheerio.load(htmlString);

		let downloadOptions = [];

		$('#downloadlink2 > b:first').find('a').each((i, elem) => {
			let downloadInfo = this.processSongDownload($, elem);
			if (downloadInfo !== undefined) downloadOptions.push(downloadInfo);
		});

		// Implement a system for asking the user for the format they wish for
		let download = downloadOptions.filter(obj => { return obj.format === 'flac' })[0];
		if (download === undefined) download = downloadOptions.filter(obj => { return obj.format === 'm4a' })[0];
		if (download === undefined) download = downloadOptions.filter(obj => { return obj.format === 'mp3' })[0];
		if (download === undefined) download = downloadOptions[0];
		if (download === undefined) console.error(`An error occured finding a download for ${this.name}.`);

		return download;
	}

	processSongDownload($, elem) {
		if (elem.children.length < 3) return;
		return {
			format: elem.children[0].data.substr(13).trim().toLowerCase(),
			size: elem.children[2].data.trim().toLowerCase(),
			url: elem.attribs.href
		};
	}

	getBestMatch() {
		let matches = stringSimilarity.findBestMatch(this.name, this.songData.map(obj => obj.name));
		return this.songData.find(obj => obj.name == matches.bestMatch.target);
	}
}