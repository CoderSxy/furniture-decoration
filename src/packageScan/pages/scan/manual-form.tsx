import { Image, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useScanStore } from '../../../stores/scanStore'
import {
  appendPhotoPaths,
  buildManualScan,
  DEFAULT_ROOM_HEIGHT_MM,
  MANUAL_SCAN_ERRORS,
  MAX_SCAN_PHOTOS,
  validateManualScan,
} from '../../../utils/scanMeasure'

export type ManualFormProps = {
  planId: string
  onSaved: () => void
}

export function ManualForm({ planId, onSaved }: ManualFormProps) {
  const upsert = useScanStore((state) => state.upsert)
  const [widthText, setWidthText] = useState('')
  const [depthText, setDepthText] = useState('')
  const [heightText, setHeightText] = useState(String(DEFAULT_ROOM_HEIGHT_MM))
  const [photoPaths, setPhotoPaths] = useState<string[]>([])

  const save = () => {
    const draft = { planId, widthText, depthText, heightText, photoPaths }
    const reason = validateManualScan(draft)
    if (reason !== 'ok') {
      Taro.showToast({ title: MANUAL_SCAN_ERRORS[reason], icon: 'none' })
      return
    }
    upsert(buildManualScan(draft, new Date().toISOString()))
    Taro.showToast({ title: '已保存房型', icon: 'success' })
    onSaved()
  }

  const pickPhotos = async () => {
    const remain = MAX_SCAN_PHOTOS - photoPaths.length
    if (remain <= 0) {
      Taro.showToast({ title: MANUAL_SCAN_ERRORS['invalid-photos'], icon: 'none' })
      return
    }
    try {
      const result = await Taro.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album'],
      })
      const incoming = (result.tempFiles ?? []).map((file) => file.tempFilePath)
      setPhotoPaths(appendPhotoPaths(photoPaths, incoming))
    } catch {
      Taro.showToast({ title: '未选择参考图', icon: 'none' })
    }
  }

  return (
    <View className='manual'>
      <Text className='manual__title'>手动填写房型</Text>
      <Text className='manual__lead'>
        当前设备暂不支持 VisionKit 测量，或未授权摄像头。请填写房间长宽高，可选最多 3
        张相册参考图（仅保存在本机，不会上传）。
      </Text>
      <Input
        className='manual__input'
        type='number'
        value={widthText}
        placeholder='长度（mm）'
        onInput={(event) => setWidthText(event.detail.value)}
      />
      <Input
        className='manual__input'
        type='number'
        value={depthText}
        placeholder='宽度（mm）'
        onInput={(event) => setDepthText(event.detail.value)}
      />
      <Input
        className='manual__input'
        type='number'
        value={heightText}
        placeholder='层高（mm）'
        onInput={(event) => setHeightText(event.detail.value)}
      />
      <View className='manual__photos'>
        {photoPaths.map((path) => (
          <Image key={path} className='manual__thumb' src={path} mode='aspectFill' />
        ))}
      </View>
      <View className='manual__secondary' onClick={() => { void pickPhotos() }}>
        <Text className='manual__secondary-text'>添加参考图（最多 {MAX_SCAN_PHOTOS} 张）</Text>
      </View>
      <View className='manual__submit' onClick={save}>
        <Text className='manual__submit-text'>保存房型</Text>
      </View>
    </View>
  )
}
