Pod::Spec.new do |s|
  s.name           = 'WeshipTodoWidget'
  s.version        = '1.0.0'
  s.summary        = 'Weship native surfaces that have no Expo package.'
  s.description    = 'Currently the system notification sound; the widgets themselves are built with expo-widgets.'
  s.author         = 'Weship'
  s.homepage       = 'https://weship.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
