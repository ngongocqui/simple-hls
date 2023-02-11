import {spawn} from 'child_process';
import DefaultRenditions from './default-renditions';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { getVideoDurationInSeconds } from 'get-video-duration';
import to from 'await-to-js';

class Transcode {
    inputPath: string;
    outputPath: string;
    options: any | undefined;
    constructor(inputPath : string, outputPath : string, options : any){
        this.inputPath = inputPath;
        this.outputPath = outputPath;
        this.options = options || {};
    }

    transcode(){
      return new Promise(async (resolve, reject) =>  {
        const commands : any  = await this.buildCommands();
        const masterPlaylist = await this.writePlaylist();
        const [err, duration] = await to(getVideoDurationInSeconds(this.inputPath));
        if (err) return reject(err);

        const ls = spawn(ffmpegPath.path, commands);
        let showLogs = true;
        if (this.options.showLogs == false){
          showLogs = false;
        }
        ls.stdout.on('data', (data: any) =>  {
          if (showLogs){
            console.log(data.toString());
          }
        });

        ls.stderr.on('data', (data) => {
          if (showLogs) {
            const splitData = data.toString().split(" ");
            const findTime = splitData.find((it: any) => it.indexOf('time=') !== -1);
            if (findTime) {
              const timeString = findTime.slice(5, findTime.length);
              const second = timeString.split(':').reduce((acc: any, time: any) => (60 * acc) + +time);

              console.log(`File ${this.inputPath} Percent complete: ${Number((second/duration) * 100).toFixed(2)}`);
            }
          }
        });

        ls.on('exit', async (code: any) =>  {
          if (showLogs){
            console.log(`Child exited with code ${code}`);
          }
          if (code == 0) return resolve(masterPlaylist);

          await this.deleteOutputPath();
          return reject('Video Failed to Transcode');
        })
      })
    }

    async deleteOutputPath() {
      for (const file of await fs.promises.readdir(this.outputPath)) {
        await fs.promises.unlink(path.join(this.outputPath, file));
      }
    }

    buildCommands(){
      return new Promise(async (resolve, reject) =>  {
        let commands = ['-hide_banner', '-y', '-i', this.inputPath];
        const renditions = this.options.renditions || DefaultRenditions;

        if (!fs.existsSync(this.outputPath)){
          await fs.promises.mkdir(this.outputPath);
        }

        for (let i = 0, len = renditions.length; i < len; i++){
          const r = renditions[i];
          commands = commands.concat(['-vf', `scale=w=${r.width}:h=${r.height}:force_original_aspect_ratio=decrease`, '-hls_flags', 'split_by_time', '-c:a', 'aac', '-ar', '48000', '-c:v', 'libx264', `-profile:v`, r.profile, '-crf', '10', '-sc_threshold', '0', '-g', '48', '-hls_time', r.hlsTime, '-hls_playlist_type', 'vod', '-b:v', r.bv, '-maxrate', r.maxrate, '-bufsize', r.bufsize, '-b:a', r.ba, '-hls_segment_filename', `${this.outputPath}/${r.ts_title}_%03d.ts`, `${this.outputPath}/${r.master_title}.m3u8`]);
        }
         resolve(commands);
      })
    }

    writePlaylist(){
      return new Promise(async (resolve, reject) =>  {
       let m3u8Playlist =  `#EXTM3U
#EXT-X-VERSION:3`;
        const renditions = this.options.renditions || DefaultRenditions;
        
        for (let i = 0, len = renditions.length; i < len; i++){
          const r = renditions[i];
          m3u8Playlist += `
#EXT-X-STREAM-INF:BANDWIDTH=${r.bv.replace('k', '000')},RESOLUTION=${r.width}x${r.height}
${r.height}.m3u8`
        }
        const m3u8Path = `${this.outputPath}/index.m3u8`
        await fs.promises.writeFile(m3u8Path, m3u8Playlist);

        resolve(m3u8Path);
      })
    }
}

export const Transcoder = Transcode;


/*
const t = new Transcoder(`${__dirname}/test.mp4`, `${__dirname}/output`, {});
t.transcode();
*/