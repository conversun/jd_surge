const remoteUrl = "https://raw.githubusercontent.com/W-Webber/jd_surge/refs/heads/feature-qx/config_helper.js";

const $argument = "clear";

(async () => {
  try {
    const resp = await $task.fetch({ url: remoteUrl });
    eval(resp.body);
  } catch (e) {
    $notify("远程脚本加载失败", "", String(e));
    $done();
  }
})();