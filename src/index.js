const Puppeteer = require("puppeteer-core")
const fs = require("fs")
var path = require('path');

//自动下载youtube上的视频以及合辑,保存到 ~/Movies/
//需要安装插件 ： 
//1、 adblock for youtube （https://chrome.google.com/webstore/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=zh-CN） 
//2、youtube-video-downloade （https://addoncrop.com/youtube-video-downloader/）

async function addCollectionButton(page) {
    await page.evaluate(() => {
        if (document.getElementById('_pp_id') != null) {
            return;
        }
        let button = document.createElement('button');
        button.setAttribute('id', '_pp_id');
        button.style.position = 'fixed';
        button.style.left = '30px';
        button.style.top = '100px';
        button.style.zIndex = '100000000';
        button.style.borderRadius = '50%';
        button.style.border = 'none';
        button.style.height = '80px';
        button.style.width = '80px';
        button.style.cursor = 'pointer';
        button.style.lineHeight = '80px';
        button.style.outline = 'none';
        button.style.fontWeight = "bold";
        button.style.fontSize = "21px";
        if (document.cookie.indexOf("autodownload")!=-1){
            button.style.color = '#999';
            button.style.background = '#D5D5D5';
            button.disabled = true;
            button.innerText = '下载中';
            setTimeout(()=>{
                window.ft2Click();
            },3000)
        }else{
            button.innerText = '下载';
            button.style.color = "white";
            button.style.background = "red";
            button.disabled = false;
            button.addEventListener('click', () => {
                window.ft2Click();
            });
        }
        document.body.appendChild(button);
    });

}



async function addEvent(page, url) {
    await page.on('domcontentloaded', async () => {
        await init(page, url);
    });
    page.on('error', () => {
        page.close();
    });
    page.on('close', () => {
    });
}

async function init(page, addr) {
    console.log('请求:', addr);
    const client = await page.target().createCDPSession();
    await client.send('Page.enable');
    await client.send('Network.enable');

    if (addr.indexOf("youtube")!=-1){
        await addCollectionButton(page);
        let findFt2Click = await page.evaluate(() => {
            return window['ft2Click'];
        });
        if (!findFt2Click) {
            findFt2Click = async function() {
                await startCollection(page);
            };
            await page.exposeFunction('ft2Click', findFt2Click).catch(() => {});
        }
    }
}

function readFileList(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    files.forEach((item, index) => {
        var fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {      
            readFileList(path.join(dir, item), filesList);  //递归读取文件
        } else {                
            filesList.push(item);
            // filesList.push(fullPath);
        }        
    });
    return filesList;
}

async function findFile(filename,dir,subDir){
    var list;
    if(subDir){
        list = readFileList(dir)
    }else{
        list = fs.readdirSync(dir);
    }
    for(var i=0;i<list.length;i++){
        var item = list[i]
        if(item.startsWith(dir)){
            item = item.split(/[/\\]/).pop()
        }
        if(filename.substring(0,15) == item.substring(0,15) && item.endsWith(".mp4")){
            return true
        }
    }
    return false
}
let downloadFileInfo = []
let setIntervalFlag ;
async function startCollection(page){
    let title = await page.evaluate((t)=>{
        isPlayer = document.querySelector("#movie_player")
        if(!isPlayer){
            var exp = new Date();
            exp.setTime(exp.getTime() - 1);
            if (document.cookie.indexOf("autodownload")!=-1){
                document.cookie= "autodownload=1;expires="+exp.toGMTString();
            }
            return false;
        }
        return document.querySelector("title").textContent;
    })
    if(!title){
        console.log("不是视频播放页面");
        return;
    }
    // if(findFile(title,'/Users/david/Downloads') || findFile(title,'/Users/david/Movies',true)){
    //     console.log(title + "文件已经存在，不用下载了");
    // }else{
        await page.waitForSelector(".el-icon-download")
        await page.click("#download-button")
        
        await page.waitFor(3000)
        let videoInfo = await page.evaluate(()=>{
            let headerEl = document.querySelector("#header-description")
            if (headerEl){
                txtEl = headerEl.querySelector("h3")
                indexEl = headerEl.querySelector(".index-message > span")
                if (txtEl && indexEl){
                    return {"info":txtEl.textContent ,"index":indexEl.textContent}
                }
            }
        })
        if (!videoInfo ){
            videoInfo = {"info":"youtube",index:""}
        }
        videoInfo.title=title;
        downloadFileInfo.push(videoInfo);
        console.log(videoInfo)
    // }
    await page.waitForSelector("#items.playlist-items")
    let stop = await page.evaluate(()=>{
        let playlist = document.querySelector("#items.playlist-items").children;
        nextItem = 0
        for(var i=0;i<playlist.length;i++){
            if(playlist[i].hasAttribute("selected")){
                nextItem = i+1;
                break;
            }
        }
        if(nextItem < playlist.length){
            if (document.cookie.indexOf("autodownload")==-1){
                var exp = new Date();
                exp.setTime(exp.getTime() + 1000*60*60*24);
                document.cookie = "autodownload=1;expires="+exp.toGMTString();
            }
            location.href = playlist[nextItem].firstElementChild.href
            return 0;
        }else{
            var exp = new Date();
            exp.setTime(exp.getTime() - 1);
            if (document.cookie.indexOf("autodownload")!=-1){
                document.cookie= "autodownload=1;expires="+exp.toGMTString();
            }
            return 1;
        }
    })

    if(stop==1){
        // setIntervalFlag = setInterval(()=>{
        //     var list = fs.readdirSync('/Users/david/Downloads');
        //     var finishDownload = true;
        //     for(var i=0;i<list.length;i++){
        //         if(list[i].endsWith("download")){
        //             finishDownload = false;
        //             break;
        //         }
        //     }
        //     if(finishDownload){
        //         afterDownloadFinish()
        //     }
        // },1000*30)
    }
        
}


function afterDownloadFinish(){
    clearInterval(setIntervalFlag)
    let nameInfo = {}
    for(var i=0;i<downloadFileInfo.length;i++){
        let video = downloadFileInfo[i];
        let dir = "/Users/david/Movies/"+video.info;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        
        let startWords = video.title.substring(0,15)
        nameInfo[startWords] = {"dir":dir,index:video.index}
    }
    var list = fs.readdirSync('/Users/david/Downloads');
    for(var i=0;i<list.length;i++){
        if(list[i].endsWith(".mp4")){
            let startWords = list[i].substring(0,15)
            let info = nameInfo[startWords];
            if(info){
                let newname =info.dir + "/"+ list[i];
                if(info.index != ""){
                    newname = info.dir + "/"+info.index +" "+ list[i];
                }
                fs.renameSync('/Users/david/Downloads/'+list[i],newname)
                console.log("mv "+'/Users/david/Downloads/'+list[i] + " "+ newname);
            }
        }
    }
    console.log("完成下载并转移到~/Movies目录下");
}



(async () => {
    const args = Puppeteer.defaultArgs().filter(arg => String(arg).toLowerCase() !== '--disable-extensions' && String(arg).toLowerCase() !== '--headless');
    console.log(args)
    const browser = await Puppeteer.launch({
        headless:false,
        defaultViewport:{
            width:1024,
            height:900
        },
        devtools: true,
        ignoreDefaultArgs: true,
        executablePath:"../local-chromium/mac-722234/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        // executablePath:"/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome",
        // args: ['--remote-debugging-port=9223','--user-data-dir=/Users/david/Workspace/nodejs/local-chromium/user-data','--disable-extensions-except=/Users/david/Workspace/nodejs/local-chromium/mac-722234/chrome-mac/extension/',
        // '--load-extension=/Users/david/Workspace/nodejs/local-chromium/mac-722234/chrome-mac/extension/','--enable-remote-extensions']
        //,'--load-extension=~/Library/Application Support/Google/Chrome/Default/Extensions'
        //,'--user-data-dir=~/Library/Application Support/Google/Chrome'
        args:args.concat(['--remote-debugging-port=9223','--user-data-dir=/Users/david/Workspace/nodejs/local-chromium/mac-722234/chrome-mac/user-data/'])
    });


    browser.on('targetcreated', async (target) => {
        let page = await target.page();
        let url = await target.url();
        await addEvent(page, url).catch((e) => {
            if(e.message.indexOf('on\' of null')==-1){
                console.error(e)
            }
        });
    });
    browser.on('targetchanged', async (target) => {
        let page = await target.page();
        let url = await target.url();
        await addEvent(page, url).catch((e) => {
            if(e.message.indexOf('on\' of null')==-1){
                console.error(e)
            }
        });
    });

    const pages = await browser.pages();
    let page;
    if(pages.length>0){
        page = pages[0];
    }else{
        page = await browser.newPage();
    }
    await page.goto("https://www.youtube.com");

    await page.evaluate(()=>{
        var exp = new Date();
        exp.setTime(exp.getTime() - 1);
        if (document.cookie.indexOf("autodownload")!=-1){
            document.cookie= "autodownload=1;expires="+exp.toGMTString();
        }
    })
    // if (!browser.isConnected()){
    //     await browser.close();
    // }
  })();
