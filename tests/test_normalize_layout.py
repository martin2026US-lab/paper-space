import unittest,sys,copy
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'python'))
from normalize_layout import normalize_layout,correct,SYMBOL_FONT,VERIFIED_FONTS

def box(page,x,y,text,start=0):
    return dict(page=page,x=x,y=y,right=x+250,bottom=y+12,pageWidth=600,pageHeight=800,charspan=[start,start+len(text)])
def chars(text,b,size=10,font='Body'):
    return [dict(char=c,font=font,fontHash=None,size=size,cx=b['x']+i,cy=b['y']+6,x=b['x']+i,y=b['y'],right=b['x']+i+1,bottom=b['bottom'],index=i) for i,c in enumerate(text) if not c.isspace()]
class NormalizationTests(unittest.TestCase):
    def test_numbers_only_change_for_verified_font_bytes(self):
        text='5 6 5 6'; cs=[]
        for i,c in enumerate('5656'):
            cs.append(dict(char=c,font='Body' if i<2 else SYMBOL_FONT,fontHash=next(iter(VERIFIED_FONTS)),page=1,index=i,x=i,y=0,right=i+1,bottom=1))
        self.assertEqual(correct(text,cs)[0],'5 6 = ±')
        for c in cs:c['fontHash']='same-name-unverified-font'
        self.assertEqual(correct(text,cs)[0],text)

    def fixture(self,bad_span=False):
        a='Evidence suggests that';note='A small footnote.';tail='the effect is measurable.'
        ba=box(1,310,700,a);bn=box(4,40,380,note,len(a)+1);bt=box(4,40,440,tail)
        if bad_span:bn['charspan'][0]+=1
        table=box(4,40,300,'Values');table['bottom']=350
        blocks=[dict(sourceRef='body',kind='text',text=a+' '+note,boxes=[ba,bn]),dict(sourceRef='image',kind='picture',text='Figure',boxes=[box(2,40,40,'Figure')]),dict(sourceRef='table',kind='table',text='Values',boxes=[table]),dict(sourceRef='tail',kind='text',text=tail,boxes=[bt])]
        pages=[chars(a,ba),[],[],chars(note,bn,8,'TableFont')+chars(tail,bt)]
        return dict(parser='docling',layoutVersion=2,pages=4,blocks=blocks),pages

    def test_note_separation_and_nonadjacent_body_continuation(self):
        data,pages=self.fixture();before=copy.deepcopy(data['blocks'])
        with patch('normalize_layout.native_pages',return_value=pages):out=normalize_layout('unused',data)
        self.assertEqual(out['blocks'],before)
        b=out['normalizedBlocks'];self.assertEqual(b[0]['text'],'Evidence suggests that the effect is measurable.')
        self.assertEqual([x['page'] for x in b[0]['boxes']],[1,4]);self.assertEqual(b[-1]['text'],'A small footnote.')
        self.assertEqual(b[-1]['kind'],'footnote');self.assertEqual(b[-1]['relatedTable'],'table')

    def test_bad_character_spans_do_not_drop_text(self):
        data,pages=self.fixture(True);text=data['blocks'][0]['text']
        with patch('normalize_layout.native_pages',return_value=pages):out=normalize_layout('unused',data)
        self.assertEqual(out['normalizedBlocks'][0]['text'],text)
        self.assertIn('join-span-mismatch',[e['type'] for e in out['quality']['uncertain']])

    def test_empty_formula_keeps_visual_source_and_no_fake_text(self):
        b=box(1,40,60,'')
        data=dict(parser='docling',layoutVersion=2,pages=1,blocks=[dict(sourceRef='equation',kind='formula',text='',boxes=[b])])
        with patch('normalize_layout.native_pages',return_value=[[]]):out=normalize_layout('unused',data)
        formula=out['normalizedBlocks'][0];self.assertTrue(formula['visualOnly']);self.assertEqual(formula['text'],'');self.assertEqual(formula['visualBoxes'][0]['x'],36)

if __name__=='__main__':unittest.main()
