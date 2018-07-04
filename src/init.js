import fs from 'fs-extra';
import childProcess from 'child_process';
import request from 'request-promise';
import path from 'path';
import targz from 'targz'

import { clearDirectory, getNpmCommandName } from './helpers';

import { DOXITYRC_FILE } from './constants';

export default function (args) {
  const { source, target } = args;
  // TODO check folder exists...
  const absoluteTarget = `${process.cwd()}/${target}`;
  const tarFilePath = `${process.env.PWD}/tarFile.tar.gz`;
  const tmpTarget = path.resolve(`${process.cwd()}/${target}/../doxity-tmp`);
  // clear the target dir
  clearDirectory(absoluteTarget)
    .then(() => {
      // clone the repo
      process.stdout.write(`Getting ${source}...\n`);
      // pipe package to thingy.
      return new Promise((resolve) => {
        // download the tar
        let ws = fs.createWriteStream(tarFilePath)

        ws.on('open', function () {
          request(source).pipe(ws)
        });

        ws.on('finish', function () {
          console.log('finished writing tar file')
          targz.decompress({
            src: tarFilePath,
            dest: tmpTarget
          }, function (err) {
            if (err) {
              console.log(err);
            } else {
              // delete the tar file
              fs.remove(tarFilePath)
                .then(() => {
                  resolve()
                })
            }
          });
        })
      });
    })
    // rename the downloaded folder to doxity
    .then(() => {
      fs.renameSync(`${tmpTarget}/${fs.readdirSync(tmpTarget)[0]}`, absoluteTarget);
      return fs.remove(tmpTarget)
    })
    .then(() => {
      // fancy spinner
      let i = 0;
      const seq = '⣷⣯⣟⡿⢿⣻⣽⣾'.split('');
      const message = 'Setting up doxity project with npm install. This may take a while...';
      const spinner = setInterval(() => {
        i++;
        if (i >= seq.length) { i = 0; }
        process.stdout.write(`\r${seq[i]} ${message}`);
      }, 1000 / 24);
      // install the deps
      const npmInstall = childProcess.spawn(getNpmCommandName(), ['install'], { cwd: absoluteTarget });
      npmInstall.stdout.removeAllListeners('data');
      npmInstall.stderr.removeAllListeners('data');
      npmInstall.stdout.pipe(process.stdout);
      npmInstall.stderr.pipe(process.stderr);
      npmInstall.on('close', () => {
        clearInterval(spinner);
        const doxityrcFile = `${process.cwd()}/${DOXITYRC_FILE}`;
        // overwrite doxityrc file
        if (fs.existsSync(doxityrcFile)) { fs.unlinkSync(doxityrcFile); }
        fs.writeFileSync(doxityrcFile, `${JSON.stringify(args, null, 2)}\n`);

        process.stdout.write('Doxity is initialized! Now run `doxity build`\n');
        process.exit();
      });
    });
}
