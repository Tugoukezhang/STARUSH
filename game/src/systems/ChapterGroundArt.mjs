import {getChapterContent} from '../utils/publicChapterContent.mjs';
export function getChapterGroundArt(id){return getChapterContent(id)?.resources.ground||null;}
export function getChapterGroundColorArt(id){return getChapterContent(id)?.resources.colorGround||null;}
