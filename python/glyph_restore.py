"""Evidence-only glyph recovery and typography. No language model or name dictionary."""
import difflib,json,re,unicodedata,statistics
from pathlib import Path
PROFILES=json.loads(Path(__file__).with_name('glyph_profiles.json').read_text(encoding='utf8'))['glyphs']
def profile(c):return PROFILES.get(c['font']+'|'+str(ord(c['char']))+'|'+str(c.get('fontHash')))
def suspicious(c):return c['font'].startswith(('AdvP','AdvT')) or c['font']=='AdvOT8817665d' or ord(c['char'])<32 and c['char']!='\x02'
def source(c):return {k:c[k] for k in ('page','index','font','fontHash','x','y','right','bottom') if k in c}

def accent_hosts(chars):
    hosts={};issues=[]
    for i,c in enumerate(chars):
        p=profile(c)
        if not p or p['mode']!='accent':continue
        candidates=[]
        for j,b in enumerate(chars):
            if i==j or b['page']!=c['page'] or not b['char'].isalpha() or suspicious(b):continue
            if b['x']-.12*b['size']<=c['cx']<=b['right']+.12*b['size'] and 0<b['cy']-c['cy']<b['size']*.9 and c['bottom']<=b['y']+b['size']*.2:
                candidates.append((abs(c['cx']-b['cx']),j))
        candidates.sort()
        if candidates and (len(candidates)==1 or candidates[1][0]-candidates[0][0]>.25*c['size']):hosts[i]=candidates[0][1]
        else:issues.append({'type':'accent-host-ambiguous',**source(c)})
    return hosts,issues

def align(text,chars,hosts):
    # PDF drawing order sometimes places an accent at the end of a line. Geometry supplies its host.
    order=[];before={}
    for accent,host in hosts.items():before.setdefault(host,[]).append(accent)
    for i in range(len(chars)):
        if i in hosts:continue
        order.extend(before.get(i,[]));order.append(i)
    indexes=[i for i,c in enumerate(text) if not c.isspace()]
    native=''.join(chars[i]['char'].replace('\x02','-') if not profile(chars[i]) else chars[i]['char'] for i in order)
    original=''.join(text[i] for i in indexes)
    matcher=difflib.SequenceMatcher(None,original,native,autojunk=False)
    ops=matcher.get_opcodes();mapped={}
    for k,(tag,a,z,b,y) in enumerate(ops):
        if tag=='equal':
            for r,n in zip(range(a,z),range(b,y)):mapped[order[n]]=indexes[r]
        elif tag=='replace' and z-a==y-b:
            left=ops[k-1] if k else None;right=ops[k+1] if k+1<len(ops) else None
            anchored=(left is None or left[0]=='equal' and left[2]-left[1]>=4) and (right is None or right[0]=='equal' and right[2]-right[1]>=4)
            if anchored and all(profile(chars[order[n]]) for n in range(b,y)):
                for r,n in zip(range(a,z),range(b,y)):mapped[order[n]]=indexes[r]
    return mapped,matcher.ratio()

def script_for(i,chars):
    c=chars[i]
    if c.get('baseline') is None or suspicious(c) and not profile(c):return None,False
    refs=[]
    for j,b in enumerate(chars):
        if i==j or c['page']!=b['page'] or not b['char'].isalnum() or suspicious(b):continue
        if not .52<=c['size']/max(b['size'],.001)<=.84:continue
        gap=max(b['x']-c['right'],c['x']-b['right'],0)
        shift=c['baseline']-b['baseline']
        if gap<=b['size']*1.25 and .14*b['size']<=abs(shift)<=.60*b['size']:
            refs.append((gap+abs(shift)*.3,'sup' if shift<0 else 'sub',j))
    refs.sort()
    if not refs:return None,False
    close=[r for r in refs if r[0]<=refs[0][0]+.15*c['size']]
    if len({r[1] for r in close})>1:return None,True
    return refs[0][1],False

def restore(text,chars):
    hosts,issues=accent_hosts(chars);mapped,ratio=align(text,chars,hosts)
    values={};scripts={};changes=[];drops=set();requires=set()
    for i,c in enumerate(chars):
        p=profile(c)
        if suspicious(c) and not p:
            issues.append({'type':'unverified-glyph',**source(c)});continue
        if p:requires.add(i)
        if p and i not in mapped:
            issues.append({'type':'glyph-text-alignment',**source(c)});continue
        if p and p['mode']=='symbol':
            values[mapped[i]]=p['value'];changes.append({'type':'symbol','raw':text[mapped[i]],'value':p['value'],**source(c)})
    for i,j in hosts.items():
        c,b=chars[i],chars[j]
        if i not in mapped or j not in mapped:
            issues.append({'type':'accent-text-alignment',**source(c)});continue
        at,base=mapped[i],mapped[j];mark=profile(c)['value'];letter=values.get(base,text[base]);letter='i' if letter=='ı' else letter
        values[base]=unicodedata.normalize('NFC',letter+mark);values[at]=''
        # Only discard extractor-inserted whitespace directly between the mark and its host.
        lo,hi=sorted((at,base))
        if not text[lo+1:hi].strip():drops.update(range(lo+1,hi))
        changes.append({'type':'accent','raw':text[at]+text[base],'value':values[base],'hostIndex':b['index'],**source(c)})
    for i,at in mapped.items():
        if i in hosts:continue
        style,ambiguous=script_for(i,chars)
        if ambiguous:issues.append({'type':'script-ambiguous',**source(chars[i])})
        if style:
            scripts[at]=style;changes.append({'type':style,'value':values.get(at,text[at]),**source(chars[i])})
    # Unmapped raised/lowered letters cannot silently become baseline numbers.
    for i,c in enumerate(chars):
        if i not in mapped and i not in hosts:
            style,_=script_for(i,chars)
            if style:issues.append({'type':'script-text-alignment',**source(c)})
    if ratio<.92 and (requires or scripts):issues.append({'type':'text-alignment-low','ratio':round(ratio,4)})
    # Remove only spacing at a geometrically contiguous script/base boundary.
    reverse={at:i for i,at in mapped.items()}
    positions=sorted(reverse)
    for a,b in zip(positions,positions[1:]):
        if a not in scripts and b not in scripts:continue
        ca,cb=chars[reverse[a]],chars[reverse[b]]
        if ca['page']==cb['page'] and b>a+1 and not text[a+1:b].strip() and -1<=cb['x']-ca['right']<=max(ca['size'],cb['size'])*.2 and abs(ca.get('baseline',0)-cb.get('baseline',0))<max(ca['size'],cb['size'])*.7:
            drops.update(range(a+1,b))
    # Only a uniquely aligned, isolated unknown glyph may become an inline crop.
    # Ambiguous joins/scripts/accents still keep the entire source region as an image.
    unknown=[i for i,c in enumerate(chars) if suspicious(c) and not profile(c)]
    inline={}
    if 0<len(unknown)<=3 and ratio>=.98 and all(issue['type']=='unverified-glyph' for issue in issues) and all(i in mapped for i in unknown):
        if len({mapped[i] for i in unknown})==len(unknown):
            for i in unknown:
                c=chars[i]
                inline[mapped[i]]={'page':c['page'],'x':c['x']-.25,'y':c['y']-.25,'right':c['right']+.25,'bottom':c['bottom']+.25,'fontSize':c['size'],'baseline':c['baseline']}
    runs=[]
    for at,c in enumerate(text):
        if at in drops:continue
        if at in inline:
            runs.append({'text':'[原图符号]','imageBox':inline[at]});continue
        value=values.get(at,c)
        if not value:continue
        style=scripts.get(at)
        if runs and not runs[-1].get('imageBox') and runs[-1].get('script')==style:runs[-1]['text']+=value
        else:runs.append({'text':value,**({'script':style} if style else {})})
    result=''.join(r['text'] for r in runs)
    evidence=''.join(('^{'+r['text']+'}' if r.get('script')=='sup' else '_{'+r['text']+'}' if r.get('script')=='sub' else r['text']) for r in runs)
    # Control codes left by either extractor are never presented as a trustworthy transcript.
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',result):issues.append({'type':'unresolved-control-code'})
    return {'text':result,'textRuns':runs,'evidenceText':evidence,'glyphChanges':changes,'glyphIssues':issues,'glyphMatch':round(ratio,4),'inlineGlyphs':bool(inline) and all(issue['type']=='unverified-glyph' for issue in issues),'sourceFontSize':statistics.median([c['size'] for c in chars]) if chars else 10}

def apply_glyph_layer(blocks,pages):
    for b in blocks:
        if b['kind'] in ('picture','table','formula','page_header','page_footer'):continue
        chars=[]
        for part in b['parts']:
            box=part['box'];chars.extend(c for c in pages[box['page']-1] if box['x']-.7<=c['cx']<=box['right']+.7 and box['y']-.7<=c['cy']<=box['bottom']+.7)
        recovered=restore(b['rawText'],chars);b.update(recovered)
        b['unverifiedGlyphs']=len(b['glyphIssues'])
        if b['inlineGlyphs']:
            for run in b['textRuns']:
                if run.get('imageBox'):
                    box=next(box for box in b['boxes'] if box['page']==run['imageBox']['page'])
                    run['imageBox'].update(pageWidth=box['pageWidth'],pageHeight=box['pageHeight'])
        if b['glyphIssues'] and not b['inlineGlyphs']:
            b['candidateText']=b['text'];b['text']='';b['textRuns']=[];b['visualOnly']=True;b['glyphFallback']=True
            b['visualBoxes']=[dict(box) for box in b['boxes']]
            b['evidenceText']='[本段包含尚未可靠还原的字符或上下标，已保留原图；未提供文字转写，不能据此猜测姓名、符号或数值。]'
