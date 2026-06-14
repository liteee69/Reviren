'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function MusicPlayer() {
  const [visible, setVisible] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lo-fi music</span>
          <Button variant="outline" className="text-xs h-7 px-2" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Hide' : 'Show'}
          </Button>
        </CardTitle>
      </CardHeader>
      {visible && (
        <CardContent>
          <iframe
            src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=0"
            title="Lo-fi music"
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full rounded-md aspect-video"
          />
        </CardContent>
      )}
      {!visible && (
        <CardContent>
          <p className="text-sm text-muted-foreground">Click Show to open the player.</p>
        </CardContent>
      )}
    </Card>
  )
}
