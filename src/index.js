'use strict'

const spotify = require('./spotify.js')
    , Scraper = require('./scraper.js')
    , Progress = require('multi-progress');

let queue = [];

async function init() {
    await spotify.init();
    let playlist = await spotify.choosePlaylist('megamawman');
    queue = await spotify.getPlaylist(playlist.id);

    let multi = new Progress(process.stdout);

    for(let obj of queue) {
        let scraper = new Scraper(obj, multi);
        scraper.start();
    }

    /*let scraper = new Scraper({
        authors: ['David Guetta', 'Bebe Rexha', 'J Balvin'],
        name: 'Say My Name',
        album: '7',
        length: 198.946
    }, new progress(process.stdout));

    scraper.start();*/
}

class Queue {
    constructor() {
        this.queue = [];
        this.multi = new Multiprogress(process.stdout);
    }

    checkQueue() {
        for (let i = 0; i < this.queue.length; i++) {
            if (this.queue[i].progress.percent >= 1) this.queue = this.queue.splice(i, 1);
            
        }
    }

    addToQueue() {
        let scraper = new Scraper(queue.unshift(), this.multi);
        this.queue.push()
    }
}

init();