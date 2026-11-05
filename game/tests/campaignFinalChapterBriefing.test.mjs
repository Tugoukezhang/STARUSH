import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerSessionExperience } from '../src/systems/PlayerSessionExperience.mjs';
import { PUBLIC_CHAPTERS, getNextPublicChapterId } from '../src/utils/publicCampaign.mjs';

for (const chapter of PUBLIC_CHAPTERS) {
  test(`${chapter.id}: briefing promises only the real next chapter or the tour ending`, () => {
    for (const first of [true, false]) {
      const paragraphs = [], commands = [];
      const session = Object.assign(Object.create(PlayerSessionExperience.prototype), {
        scene: { battleData: { performerId: 'sakura' } },
        canShowChapterRules: () => true, chapterId: () => chapter.id,
        open: () => ({}), appendStory() {},
        paragraph: (_panel, text, kind) => paragraphs.push({ text, kind }),
        command: (_panel, text) => commands.push(text),
      });
      session.showBriefing(first);
      const note = paragraphs.find(row => row.kind === 'session-note').text;
      if (getNextPublicChapterId(chapter.id)) {
        assert(note.includes('解锁下一站'));
      } else {
        assert(!note.includes('下一站'), 'final chapter must not promise another unlock');
        assert(note.includes('本轮巡演'));
        assert(!note.includes('三站巡演'));
      }
      assert(note.includes('刷新页面会结束当前公演'));
      assert.deepEqual(commands, [first ? '准备开演' : '返回']);
    }
  });
}
