// Renders assets/illustrations/*.svg to PNG at @1x, @2x and @3x, so the app
// shows them with a plain <Image> and needs no SVG library.
// Run `yarn build:illustrations` after adding or replacing an SVG.
const fs = require('fs');
const path = require('path');
const {Resvg} = require('@resvg/resvg-js');

const SRC = path.join(__dirname, '..', 'assets', 'illustrations');
const OUT = path.join(__dirname, '..', 'src', 'components', 'shared', 'illustrations');

// Width in points on screen: the feeling tiles.
const WIDTH = 56;

fs.mkdirSync(OUT, {recursive: true});
for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.svg'))) {
  const name = path.basename(file, '.svg');
  const svg = fs.readFileSync(path.join(SRC, file));
  for (const scale of [1, 2, 3]) {
    const width = WIDTH * scale;
    const png = new Resvg(svg, {fitTo: {mode: 'width', value: width}}).render().asPng();
    const suffix = scale === 1 ? '' : `@${scale}x`;
    fs.writeFileSync(path.join(OUT, `${name}${suffix}.png`), png);
  }
  console.log(`${name}: done`);
}
