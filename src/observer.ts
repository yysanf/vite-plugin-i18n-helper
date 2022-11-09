import fs from "node:fs";

type Dict = Record<string, string>;

export class JsonSubject {
  Observers: Observer[];
  constructor() {
    this.Observers = [];
  }
  startWatch(jsonPath: string) {
    let timer, watcher;
    const pollying = () => {
      if (watcher) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.startWatch(jsonPath);
      }, 3000);
    };
    try {
      const handler = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.read(jsonPath);
        }, 1000);
      };
      if (fs.existsSync(jsonPath)) {
        watcher = fs.watch(jsonPath, handler);
        watcher.on("error", () => {
          watcher.close();
          watcher = void 0;
          this.notify({});
          pollying();
        });
        this.read(jsonPath);
      } else {
        pollying();
      }
    } catch (error) {
      pollying();
    }
  }
  read(jsonPath: string) {
    let data: Dict = {};
    if (fs.existsSync(jsonPath)) {
      const str = fs.readFileSync(jsonPath, "utf-8");
      try {
        data = JSON.parse(str) as Dict;
      } catch (error) {
        data = {};
      }
    }
    this.notify(data);
  }
  add(observer) {
    //添加
    this.Observers.push(observer);
  }
  remove(observer) {
    //移除
    this.Observers.filter((item) => item === observer);
  }
  notify(data: Dict) {
    //通知所有观察者
    this.Observers.forEach((item) => {
      item.update(data);
    });
  }
}

export class Observer {
  data: Dict;
  constructor(data: Dict) {
    this.data = data;
  }
  update(data: Dict) {
    this.data = data;
  }
}
