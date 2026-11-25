import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { COLORS } from './config'

// M0 placeholder HUD: proves the UI layer renders in preview. Replaced by ui/hud.tsx in M1+.
export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 24, left: '50%' },
        margin: { left: -220 },
        width: 440,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center'
      }}
      uiBackground={{ color: Color4.create(0.04, 0.04, 0.04, 0.75) }}
      uiText={{ value: 'THE FINAL REHEARSAL — setup OK (M0)', fontSize: 18, color: Color4.fromHexString(COLORS.ivory) }}
    />
  ))
}
