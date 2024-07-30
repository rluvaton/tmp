import { MultiProgressBar } from "../src/multi-progress-bar/multi-progress-bar.js";
import {
  kPercent,
  kProgressBar,
  kTotal,
  kValue,
} from "../src/multi-progress-bar/predefined-variables.js";
import type { SingleProgressBar } from "../src/multi-progress-bar/single-bar.js";

const multiProgressBar = new MultiProgressBar();

const progressBars: SingleProgressBar[] = [];

let index = 0;

function createProgressBar(current: number, total: number) {
  index++;
  return multiProgressBar.add({
    value: current,
    total: total,
    template: [
      //
      `${index} Downloading`,
      " | ",
      kProgressBar,
      " | ",
      kPercent,
      " # ",
      kValue,
      "/",
      kTotal,
    ],
  });
}

for (let i = 0; i < 5; i++) {
  progressBars.push(createProgressBar(0, 100 * (i + 1)));
}

setInterval(() => {
  if (!progressBars.length) {
    progressBars.push(createProgressBar(0, 50));
    return;
  }

  for (const single of progressBars) {
    if (Math.random() < 0.1 && progressBars.length < 20) {
      progressBars.push(createProgressBar(0, 50));
      continue;
    }

    if (single.getCurrent() >= single.getTotal() || Math.random() < 0.01) {
      single.stop();
      progressBars.splice(progressBars.indexOf(single), 1);
      continue;
    }

    single.increment();
  }
}, 100);
//
// setTimeout(() => {
//   process.exit(1);
// }, 10000);
