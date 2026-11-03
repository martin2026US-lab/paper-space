import unittest,sys,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'python'))
from glyph_restore import restore,PROFILES,apply_glyph_layer

def c(ch,x=0,baseline=30,size=10,font='Normal',digest=None,index=0):
    return dict(char=ch,font=font,fontHash=digest,x=x,y=baseline-size*.7,right=x+size*.5,bottom=baseline,cx=x+size*.25,cy=baseline-size*.35,size=size,baseline=baseline,page=1,index=index)
def trusted(value,mode='symbol'):
    key=next(k for k,p in PROFILES.items() if p['value']==value and p['mode']==mode)
    font,code,digest=key.split('|');return c(chr(int(code)),font=font,digest=digest)
class GlyphTests(unittest.TestCase):
    def test_literal_numbers_and_letters_are_not_greek_or_isotope_guesses(self):
        text='18F 5 6 beta';cs=[c(ch,i*6,index=i) for i,ch in enumerate(text) if not ch.isspace()]
        r=restore(text,cs);self.assertEqual(r['text'],text);self.assertFalse(r['glyphIssues']);self.assertFalse(any(x.get('script') for x in r['textRuns']))
    def test_font_hash_and_geometry_are_required(self):
        known=trusted('β');known['index']=4
        cs=[c(ch,i*6,index=i) for i,ch in enumerate('aaabccc')];cs[3]={**known,'x':18,'right':23,'cx':20.5,'index':3}
        self.assertEqual(restore('aaabccc',cs)['text'],'aaaβccc')
        cs[3]['fontHash']='different-embedded-font';r=restore('aaabccc',cs);self.assertEqual(r['text'],'aaa[原图符号]ccc');self.assertTrue(r['glyphIssues']);self.assertTrue(r['inlineGlyphs'])
        self.assertNotIn('β',r['evidenceText']);self.assertEqual(r['textRuns'][1]['imageBox']['page'],1)
    def test_unknown_glyph_needs_exact_alignment_and_missing_text_keeps_whole_image(self):
        cs=[c(ch,i*6,index=i) for i,ch in enumerate('abcde xyz') if not ch.isspace()]
        cs[4].update(font='AdvOT8817665d',fontHash='unreviewed-font')
        box=dict(page=1,x=0,y=0,right=100,bottom=60,pageWidth=600,pageHeight=800)
        b=dict(kind='text',text='abcde xyz',rawText='abcde xyz',boxes=[box],parts=[{'box':box}])
        apply_glyph_layer([b],[cs]);self.assertTrue(b['inlineGlyphs']);self.assertFalse(b.get('glyphFallback'));self.assertEqual(b['text'],'abcd[原图符号] xyz')
        self.assertEqual(b['textRuns'][1]['imageBox']['pageWidth'],600);self.assertEqual(b['rawText'],'abcde xyz')
        b=dict(kind='text',text='abcd xyz',rawText='abcd xyz',boxes=[box],parts=[{'box':box}])
        apply_glyph_layer([b],[cs]);self.assertTrue(b['glyphFallback']);self.assertFalse(b['inlineGlyphs']);self.assertEqual(b['text'],'');self.assertNotIn('abcd',b['evidenceText'])
    def test_remaining_control_code_disables_partial_image_fallback(self):
        text='A long ordinary sentence e followed by a control \x01.'
        cs=[c(ch,i*6,index=i) for i,ch in enumerate(text) if not ch.isspace() and ch!='\x01']
        next(z for z in cs if z['index']==25).update(font='AdvOT8817665d',fontHash='unreviewed-font')
        r=restore(text,cs);self.assertFalse(r['inlineGlyphs']);self.assertTrue(any(i['type']=='unresolved-control-code' for i in r['glyphIssues']))
    def test_accent_uses_unique_visual_host_and_composes_unicode(self):
        text='Name Hernandez';cs=[c(ch,i*6,index=i) for i,ch in enumerate(text) if not ch.isspace()]
        host=next(z for z in cs if z['index']==9);accent=trusted('\u0301','accent');accent.update(x=host['x']+1,right=host['x']+4,cx=host['x']+2.5,y=19,bottom=21,cy=20,index=50)
        cs.insert(cs.index(host),accent)
        r=restore('Name Hern\x13andez',cs);self.assertEqual(r['text'],'Name Hernández');self.assertFalse(r['glyphIssues'])
    def test_subscripts_and_superscripts_come_from_baselines(self):
        cs=[c('x',0),c('2',5.5,26,6),c('a',25),c('y',42),c('3',48,32.5,6),c('b',65)]
        for i,z in enumerate(cs):z['index']=i
        r=restore('x 2 a y 3 b',cs);self.assertIn('x^{2}',r['evidenceText']);self.assertIn('y_{3}',r['evidenceText']);self.assertFalse(r['glyphIssues'])
    def test_ambiguous_script_retains_image_and_never_sends_candidate(self):
        cs=[c('a',0,26,10),c('2',6,30,6),c('b',10,34,10)]
        for i,z in enumerate(cs):z['index']=i
        box=dict(page=1,x=0,y=0,right=100,bottom=60,pageWidth=600,pageHeight=800)
        b=dict(kind='text',text='a2b',rawText='a2b',boxes=[box],parts=[{'box':box}])
        apply_glyph_layer([b],[cs]);self.assertTrue(b['glyphFallback']);self.assertEqual(b['text'],'');self.assertIn('保留原图',b['evidenceText']);self.assertNotIn('a2b',b['evidenceText']);self.assertEqual(b['rawText'],'a2b')

if __name__=='__main__':unittest.main()
