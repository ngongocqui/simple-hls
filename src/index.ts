import DefaultRenditions from './default-renditions';
import Ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import to from 'await-to-js';

Ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
        const commands: any  = await this.buildCommands();
        const m3u8Path = `${this.outputPath}/index.m3u8`;

        Ffmpeg(this.inputPath)
        .outputOptions(commands)
        .output(m3u8Path)
        .on('error', async (err) => {
          await to(this.deleteOutputPath());
          reject(err);
        })
        .on('progress', (progress) => {
          console.log(`File ${this.inputPath} Percent complete: ${Number(progress?.percent || 0).toFixed(2)}`);
        })
        .on('end', () => {
          resolve(m3u8Path);
        })
        .run();
      })
    }

    async deleteOutputPath() {
      for (const file of await fs.promises.readdir(this.outputPath)) {
        await fs.promises.unlink(path.join(this.outputPath, file));
      }
      fs.promises.rmdir(this.outputPath);
    }

    buildCommands(){
      return new Promise(async (resolve, reject) =>  {
        let commands = ['-hide_banner', '-y'];
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
}

export const Transcoder = Transcode;


/*
const t = new Transcoder(`${__dirname}/test.mp4`, `${__dirname}/output`, {});
t.transcode();
*/