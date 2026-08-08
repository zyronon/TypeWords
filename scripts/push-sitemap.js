const fs = require("fs");
const bookList = require('../../../public/list/article.json')
const dictList = require('../../../public/list/word.json')

async function pushUrls() {
  // 配置区：改成你的
  const site = "https://typewords.cc"; // 必须和百度站长平台注册的域名一致
  const token = ""; // 在百度站长平台获取

  // 读取 urls.txt，每行一个 URL
  let urls = bookList.flat().map(book => {
    return site + '/practice-articles/' + book.id
  }).concat(dictList.flat().map(book => {
    return site + '/practice-words/' + book.id
  })).concat([
    site + '/words',
    site + '/articles',
    site + '/setting',
  ]).slice(7, 17)

  if (urls.length === 0) {
    console.error("❌ urls.txt 里没有 URL");
    return;
  }

  console.log(`📄 读取到 ${urls.length} 个 URL，准备推送到百度...`);

  const api = `http://data.zz.baidu.com/urls?site=${site}&token=${token}`;
  const body = urls.join("\n");

  try {
    const res = await fetch(api, {
      method: "POST",
      headers: {"Content-Type": "text/plain"},
      body
    });

    const data = await res.json();
    console.log("✅ 百度返回：", data);
  } catch (err) {
    console.error("❌ 推送失败：", err);
  }
}

pushUrls();
