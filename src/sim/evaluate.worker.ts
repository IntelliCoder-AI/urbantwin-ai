import { repeat, type Config } from './engine';
self.onmessage = (event: MessageEvent<Config>) => {
  try {
    self.postMessage({ result: repeat(event.data) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
