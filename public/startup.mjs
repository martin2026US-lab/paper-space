const screen=document.getElementById('startupScreen'),workspace=document.querySelector('.app');
const status=document.getElementById('startupStatus'),hint=document.getElementById('startupHint'),retry=document.getElementById('startupRetry');
const started=performance.now();let finished=false,finishing;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Two paint opportunities after canvas/text/image work; hidden windows must also settle.
function afterPaint(){return new Promise(resolve=>{const timeout=setTimeout(resolve,150);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));});}
const slow=setTimeout(()=>{if(!finished&&screen.dataset.state!=='error'){screen.dataset.state='slow';hint.textContent='首次打开或较大的文献可能需要更久。';}},8000);
const delayed=setTimeout(()=>{if(!finished){hint.textContent='准备尚未完成。可以继续等待，或重新尝试。';retry.hidden=false;}},30000);
retry.onclick=()=>window.location.reload();
export const startup={
  stage(text){if(!finished&&screen.dataset.state!=='error')status.textContent=text;},
  ready(waitForContent=async()=>{}){
    if(finishing)return finishing;
    finishing=(async()=>{
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await wait(Math.max(0,(reduced?0:1250)-(performance.now()-started)));
      await waitForContent();await afterPaint();await waitForContent();
      finished=true;clearTimeout(slow);clearTimeout(delayed);
      status.textContent='阅读，从这里展开。';screen.dataset.state='ready';
      workspace.inert=false;workspace.setAttribute('aria-busy','false');document.body.classList.remove('is-starting');
      screen.classList.add('is-leaving');
      await wait(reduced?0:360);screen.hidden=true;
      document.dispatchEvent(new Event('paper-space:ready'));
    })();return finishing;
  },
  fail(){if(finished)return;clearTimeout(slow);clearTimeout(delayed);screen.dataset.state='error';status.textContent='暂时未能打开工作台';hint.textContent='请重新尝试。已保存的文献和阅读记录会保留。';retry.hidden=false;},
};
document.getElementById('appScript')?.addEventListener('error',()=>startup.fail());
