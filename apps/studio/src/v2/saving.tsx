// "Not saved", with a way to try again: at the top of the page, and inside a sheet open over it (an open sheet makes the
// page behind it unreachable, so the sheet says it too). One short line and the button, on a phone too.
import { Btn, Icon } from '../ui.tsx';
import { retrySaves, saveState } from './data/store.ts';
import { t } from './i18n.ts';

export function SaveFailedLine() {
  if (saveState.value !== 'failed') return null;
  return (
    <div class="savebar savebar-v2" role="alert" data-save-failed>
      <Icon name="alert" /><span>{t('save2.failed')}</span>
      <Btn small kind="primary" onClick={() => retrySaves()} data-action="retry-saves">{t('app.retry')}</Btn>
    </div>
  );
}
