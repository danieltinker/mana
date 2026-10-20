// "Not saved", with a way to try again: at the top of the page, and inside a sheet open over it (an open sheet makes the
// page behind it unreachable, so the sheet says it too).
import { Btn, Icon } from '../ui.tsx';
import { retrySaves, saveProblem, saveState } from './data/store.ts';
import { errText, t } from './i18n.ts';

export function SaveFailedLine() {
  if (saveState.value !== 'failed') return null;
  return (
    <div class="savebar" role="alert" data-save-failed>
      <Icon name="alert" /><span>{t('save2.failedLong')} {errText(saveProblem.value)}</span>
      <Btn small kind="primary" onClick={() => retrySaves()} data-action="retry-saves">{t('app.retry')}</Btn>
    </div>
  );
}
