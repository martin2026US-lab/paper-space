import test from 'node:test';import assert from 'node:assert/strict';
import {pdfViewScale,normalizePdfZoom,loadPdfZoom} from '../public/pdf-view.mjs';
test('Native PDF fit width uses the available reader width, including wide laptop windows',()=>{
 assert.equal(pdfViewScale({width:612,height:792,availableWidth:1224,availableHeight:600}),2);
 assert.equal(pdfViewScale({width:612,height:792,availableWidth:306,availableHeight:600}),.5);
 assert.equal(pdfViewScale({width:792,height:612,availableWidth:1188,availableHeight:600}),1.5);
});
test('PDF whole-page fit and percentage zoom use the same native scale for canvas and text',()=>{
 assert.equal(pdfViewScale({width:612,height:792,availableWidth:1224,availableHeight:396,mode:'fit-page'}),.5);
 assert.equal(pdfViewScale({width:612,height:792,availableWidth:1224,availableHeight:396,mode:'150'}),2);
 assert.equal(normalizePdfZoom('invalid'),'fit-width');assert.equal(normalizePdfZoom('9999'),'fit-width');assert.equal(normalizePdfZoom('125'),'125');assert.equal(loadPdfZoom({getItem(){throw Error();}}),'fit-width');
});
