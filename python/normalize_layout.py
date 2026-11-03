"""Additive, offline reading layer. Never change the parser's raw blocks.

Rules are geometric/font-based, not keyed to article names or text passages.
Uncertain joins are kept separate; unknown glyphs are reported, never guessed.
"""
import copy
import ctypes
import difflib
import hashlib
import math
import re
import statistics
from collections import Counter
import pypdfium2 as pdfium
from pypdfium2 import raw

VERSION = "reading-quality-v3"
# Verified in the bundled JNM corpus. This is NOT a global character replacement.
SYMBOL_FONT = "AdvOT8817665d"
SYMBOLS = {"5": "=", "6": "±", "2": "−", "k": "κ", "a": "α", ".": ">", ",": "<", "$": "≥"}
VERIFIED_FONTS = {
    '2541b8aaffa76c53aed756d42cf8d97ebe947200de50769b6d55f606f57659d1',
    'e336cfe0c6f7dbdddf7efc1ce90f0ce83d44d15feb262ece4f00e966e4c02312',
    'cc7ac36342ec29c09a34c16e05d83e814019c1b4a1300782a8133263ebd7a06c',
    'd47993c8116cf2514ca17f345cfeccfcbc8d6c097c7dd462b5b62057e3c0428c',
    '5870ac2261231c26fb8258b94b8d71266579d43f4f428f4722065d139955fc86',
    'f9cad1a26d770592debd7361b80ac6dfbfce5ab5e1e40d47b0131a32f293b07e',
    'a6ad666a7574ebaa05d23bfd6b556049d1c55b14f72c0dd33456f97bc173c370',
}
BODY = {"text", "list_item"}

def compact(text):
    return ''.join(c for c in text if not c.isspace())

def inside(c, b, pad=.7):
    return b['x']-pad <= c['cx'] <= b['right']+pad and b['y']-pad <= c['cy'] <= b['bottom']+pad

def font_name(tp, i):
    flags = ctypes.c_int()
    n = raw.FPDFText_GetFontInfo(tp, i, None, 0, ctypes.byref(flags))
    if not n or n > 4096:
        return ''
    buf = ctypes.create_string_buffer(n)
    raw.FPDFText_GetFontInfo(tp, i, buf, n, ctypes.byref(flags))
    return buf.value.decode('utf8', 'replace').split('+', 1)[-1] if re.match(rb'^[A-Z]{6}\+',buf.value) else buf.value.decode('utf8','replace')

def native_pages(source):
    result = []
    with pdfium.PdfDocument(source) as pdf:
        for page in pdf:
            height = page.get_height()
            chars = []
            font_hashes = {}
            tp = page.get_textpage()
            try:
                for i in range(tp.count_chars()):
                    char = chr(raw.FPDFText_GetUnicode(tp, i))
                    if not char.strip() or char == '\x00':
                        continue
                    l,b,r,t = tp.get_charbox(i)
                    matrix=raw.FS_MATRIX()
                    rendered_size=raw.FPDFText_GetFontSize(tp,i)
                    if raw.FPDFText_GetMatrix(tp,i,ctypes.byref(matrix)):
                        rendered_size*=math.hypot(matrix.c,matrix.d)
                    font = font_name(tp,i); digest=None
                    if font==SYMBOL_FONT or font.startswith(('AdvP','AdvT')) or font.endswith('+20'):
                        handle=raw.FPDFTextObj_GetFont(raw.FPDFText_GetTextObject(tp,i))
                        key=ctypes.cast(handle,ctypes.c_void_p).value
                        if key not in font_hashes:
                            size=ctypes.c_size_t()
                            if raw.FPDFFont_GetFontData(handle,None,0,ctypes.byref(size)) and 0<size.value<5_000_000:
                                data=(ctypes.c_ubyte*size.value)()
                                font_hashes[key]=hashlib.sha256(bytes(data)).hexdigest() if raw.FPDFFont_GetFontData(handle,data,size,ctypes.byref(size)) else None
                            else:font_hashes[key]=None
                        digest=font_hashes[key]
                    ox=ctypes.c_double();oy=ctypes.c_double()
                    has_origin=raw.FPDFText_GetCharOrigin(tp,i,ctypes.byref(ox),ctypes.byref(oy))
                    chars.append({'char':char, 'font':font, 'fontHash':digest, 'size':rendered_size,
                                  'baseline':height-oy.value if has_origin else None,'originX':ox.value if has_origin else None,
                                  'cx':(l+r)/2, 'cy':height-(b+t)/2, 'x':l,'y':height-t,'right':r,'bottom':height-b,'index':i})
            finally:
                tp.close()
            result.append(chars)
            page.close()
    return result

def metrics(chars):
    text = [c for c in chars if c['char'].isalnum() and c['size']>0]
    return {'size':statistics.median(c['size'] for c in text) if text else 0,
            'font':Counter(c['font'] for c in text).most_common(1)[0][0] if text else ''}

def correct(text, chars):
    indexes = [i for i,c in enumerate(text) if not c.isspace()]
    native = ''.join(c['char'].replace('\x02','-') for c in chars)
    original = ''.join(text[i] for i in indexes)
    match = difflib.SequenceMatcher(None, original, native, autojunk=False)
    changes, result = [], list(text)
    # A bad spatial/text match must not authorize replacing numbers or punctuation.
    if match.ratio() < .80:
        return text, [], round(match.ratio(),3)
    for a,b,n in match.get_matching_blocks():
        for offset in range(n):
            c = chars[b+offset]
            if c['font'] == SYMBOL_FONT and c.get('fontHash') in VERIFIED_FONTS and c['char'] in SYMBOLS:
                at=indexes[a+offset]; new=SYMBOLS[c['char']]
                result[at]=new
                changes.append({'offset':at,'raw':c['char'],'value':new,'font':c['font'],'fontHash':c['fontHash'],
                                'page':c['page'],'nativeIndex':c['index'],
                                'box':{k:c[k] for k in ('x','y','right','bottom')}})
    return ''.join(result), changes, round(match.ratio(),3)

def table_for(box, tables):
    candidates=[]
    for t in tables:
        for b in t['boxes']:
            overlap=max(0,min(b['right'],box['right'])-max(b['x'],box['x']))
            if b['page']==box['page'] and -2<=box['y']-b['bottom']<=100 and overlap/max(1,box['right']-box['x'])>.65:
                candidates.append((box['y']-b['bottom'],t))
    return min(candidates,key=lambda x:x[0])[1] if candidates else None

def normalize_layout(source, payload):
    pages=native_pages(source)
    for pn,cs in enumerate(pages,1):
        for c in cs:c['page']=pn
    blocks=copy.deepcopy(payload['blocks']); tables=[b for b in blocks if b['kind']=='table']
    events=[]; uncertain=[]; detached=[]; normalized=[]
    for b in blocks:
        b['sourceRefs']=[b['sourceRef']]; b['rawText']=b['text']
        parts=[[c for c in pages[box['page']-1] if inside(c,box)] for box in b['boxes']]
        b['parts']=[{'sourceRef':b['sourceRef'],'box':copy.deepcopy(box),'nativeText':''.join(c['char'] for c in cs),**metrics(cs)} for box,cs in zip(b['boxes'],parts)]
        b['text'], b['symbolCorrections'], ratio=correct(b['text'],[c for cs in parts for c in cs])
        b['textMatch']=ratio
        unknown=[c for cs in parts for c in cs if (c['font']==SYMBOL_FONT and (c['char'] not in SYMBOLS or c.get('fontHash') not in VERIFIED_FONTS)) or c['font'].startswith('AdvP')]
        if unknown and b['kind'] not in ('picture','formula','table','page_footer','page_header'):
            uncertain.append({'type':'unverified-glyphs','sourceRef':b['sourceRef'],'count':len(unknown),'pages':sorted({c['page'] for c in unknown})})
            b['unverifiedGlyphs']=len(unknown)
        if b['kind']=='formula':
            # The original pixels are authoritative; don't expose the raw equation as AI evidence.
            b['formulaText']=b['text']; b['text']=''; b['visualOnly']=True
            b['visualBoxes']=[{**box,'x':max(0,box['x']-4),'y':max(0,box['y']-4),
                               'right':min(box['pageWidth'],box['right']+4),'bottom':min(box['pageHeight'],box['bottom']+4)} for box in b['boxes']]
            events.append({'type':'formula-original','sourceRef':b['sourceRef'],'pages':[box['page'] for box in b['boxes']]})
        suspect=[]
        if b['kind'] in BODY and len(parts)>1:
            first=b['parts'][0]
            for i,p in enumerate(b['parts'][1:],1):
                t=table_for(p['box'],tables)
                if first['size']-p['size']>.75 and p['font']!=first['font'] and t:
                    suspect.append((i,t))
            if suspect:
                # Splitting is allowed only when provenance intervals cover the complete text.
                spans=[box.get('charspan') for box in b['boxes']]
                valid=all(s and len(s)==2 and 0<=s[0]<=s[1]<=len(b['rawText']) for s in spans)
                valid=valid and spans[0][0]==0 and spans[-1][1]==len(b['rawText'])
                valid=valid and all(not b['rawText'][a[1]:z[0]].strip() for a,z in zip(spans,spans[1:]))
                if valid:
                    valid=all(difflib.SequenceMatcher(None,compact(b['rawText'][s[0]:s[1]]),compact(p['nativeText']).replace('\x02','-'),autojunk=False).ratio()>.80 for s,p in zip(spans,b['parts']))
                if valid:
                    note_ids={i:t for i,t in suspect}; bodyparts=[]
                    for i,(s,p) in enumerate(zip(spans,b['parts'])):
                        q=copy.deepcopy(b); q.update(sourceRef=b['sourceRef']+'#part'+str(i),boxes=[b['boxes'][i]],parts=[p],rawText=b['rawText'][s[0]:s[1]])
                        q['text'],q['symbolCorrections'],q['textMatch']=correct(q['rawText'],parts[i])
                        if i in note_ids:
                            q.update(kind='footnote',relatedTable=note_ids[i]['sourceRef']);detached.append(q)
                        else:bodyparts.append(q)
                    b['sourceRef']+='#body';b['boxes']=[x for p in bodyparts for x in p['boxes']];b['parts']=[x for p in bodyparts for x in p['parts']]
                    b['rawText']=' '.join(p['rawText'] for p in bodyparts);b['text']=' '.join(p['text'] for p in bodyparts)
                    b['symbolCorrections']=[x for p in bodyparts for x in p['symbolCorrections']];b['repairedJoin']=True
                    events.append({'type':'detach-table-note','sourceRef':b['sourceRefs'][0],'parts':[{'index':i,'table':t['sourceRef']} for i,t in suspect]})
                else:uncertain.append({'type':'join-span-mismatch','sourceRef':b['sourceRef']})
        normalized.append(b)
    # Absorb a math-font fragment only if its entire box lies inside a formula box.
    removed=set()
    formulas=[b for b in normalized if b['kind']=='formula']
    for b in normalized:
        if b['kind'] not in BODY or not re.fullmatch(r'(?:ffi|fi|f|i|\s){12,}',b['text']):continue
        for f in formulas:
            if all(any(x['page']==y['page'] and x['x']>=y['x']-1 and x['right']<=y['right']+1 and x['y']>=y['y']-1 and x['bottom']<=y['bottom']+1 for y in f['boxes']) for x in b['boxes']):
                f['sourceRefs']+=b['sourceRefs'];f.setdefault('absorbedFragments',[]).append(b);removed.add(b['sourceRef'])
                events.append({'type':'formula-fragment','sourceRef':b['sourceRef'],'formula':f['sourceRef']});break
    normalized=[b for b in normalized if b['sourceRef'] not in removed]
    # Padding must not capture a neighbouring equation or its definition line.
    for f in formulas:
        for box,crop in zip(f['boxes'],f['visualBoxes']):
            for other in normalized:
                if other is f:continue
                for near in other['boxes']:
                    if near['page']!=box['page'] or min(near['right'],box['right'])<=max(near['x'],box['x']):continue
                    if near['bottom']<=box['y']:
                        crop['y']=max(crop['y'],(near['bottom']+box['y'])/2)
                    if near['y']>=box['bottom']:
                        crop['bottom']=min(crop['bottom'],(near['y']+box['bottom'])/2)
    # Put detached notes below their own table, after its caption and existing notes.
    for note in detached:
        at=next(i for i,b in enumerate(normalized) if b['sourceRef']==note['relatedTable'])+1
        while at<len(normalized) and normalized[at]['kind'] in ('caption','footnote') and normalized[at]['boxes'][0]['page']==note['boxes'][0]['page']:at+=1
        normalized.insert(at,note)
    # Reconnect only repaired body tails with the next body fragment in semantic order.
    # Figure-only intervening pages are allowed; intervening headings/body are not skipped.
    consumed=set()
    for i,b in enumerate(normalized):
        if not b.get('repairedJoin'):continue
        nxt=next((x for x in normalized[i+1:] if x['kind'] in BODY|{'section_header','title','formula'}),None)
        if not nxt:continue
        end=b['parts'][-1];start=nxt['parts'][0]
        safe=(nxt['kind'] in BODY and re.search(r'[a-z,\-]$',b['text'].rstrip()) and re.match(r'^[a-z]',nxt['text'])
              and abs(end['size']-start['size'])<.4 and end['font']==start['font']
              and end['box']['page']<start['box']['page'])
        if safe:
            b['text']+=' '+nxt['text'];b['rawText']+=' '+nxt['rawText'];b['boxes']+=nxt['boxes'];b['parts']+=nxt['parts'];b['sourceRefs']+=nxt['sourceRefs'];b['symbolCorrections']+=nxt['symbolCorrections']
            consumed.add(nxt['sourceRef']);events.append({'type':'validated-continuation','sourceRef':b['sourceRef'],'continuation':nxt['sourceRef'],'pages':[p['box']['page'] for p in b['parts']]})
        else:uncertain.append({'type':'continuation-needs-review','sourceRef':b['sourceRef']})
    normalized=[b for b in normalized if b['sourceRef'] not in consumed]
    from glyph_restore import apply_glyph_layer
    apply_glyph_layer(normalized,pages)
    uncertain=[u for u in uncertain if u['type']!='unverified-glyphs']
    uncertain += [{'type':'glyph-inline-image' if b.get('inlineGlyphs') else 'glyph-image-fallback','sourceRef':b['sourceRef'],'count':len(b['glyphIssues']),
                   'reasons':sorted({i['type'] for i in b['glyphIssues']})} for b in normalized if b.get('glyphFallback') or b.get('inlineGlyphs')]
    coverage=[]
    for pn,chars in enumerate(pages,1):
        boxes=[box for b in normalized for box in b['boxes'] if box['page']==pn]
        missing=[c for c in chars if not any(inside(c,b) for b in boxes)]
        coverage.append({'page':pn,'nativeCharacters':len(chars),'uncoveredCharacters':len(missing),
                         'uncovered':[{k:c[k] for k in ('char','font','x','y','right','bottom')} for c in missing]})
    payload['normalizedBlocks']=normalized
    payload['quality']={'version':VERSION,'events':events,'uncertain':uncertain,'coverage':coverage,
                        'glyphRecovery':{'profileVersion':1,'changes':sum(len(b.get('glyphChanges',[])) for b in normalized if not b.get('glyphFallback')),
                                         'fallbackUnits':sum(bool(b.get('glyphFallback')) for b in normalized),
                                         'inlineImageUnits':sum(bool(b.get('inlineGlyphs')) for b in normalized)},
                        'symbolCorrections':sum(len(b['symbolCorrections']) for b in normalized),
                        'limits':['Native text only; scanned PDFs require separate OCR verification.','Formula images are retained, not transcribed or interpreted.','Only the verified font/glyph allowlist is repaired.']}
    return payload
