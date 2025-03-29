{
	'target_defaults': {
		'default_configuration': 'Release',
		'configurations': {
			'Common': {
				# Common settings remain largely the same
				'cflags_cc': [ '-std=c++17', '-g', '-Wno-unknown-pragmas' ],
				'cflags_cc!': [ '-fno-exceptions' ],
				'include_dirs': [ './src', './vendor' ],
				'xcode_settings': {
					'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
					'GCC_GENERATE_DEBUGGING_SYMBOLS': 'YES', # Keep debug symbols for release, can be stripped later
					'CLANG_CXX_LANGUAGE_STANDARD': 'c++17',
					'MACOSX_DEPLOYMENT_TARGET': '10.12',
				},
				'msvs_settings': {
					'VCCLCompilerTool': {
						'AdditionalOptions': [ '-std:c++17', '/GR' ],
						'ExceptionHandling': '1',
						'DebugInformationFormat': '3', # Program Database /Zi
					},
				},
				'msvs_disabled_warnings': [
					4101, # Unreferenced local (msvc fires these for ignored exception)
					4068, # Unknown pragma
				],
				'conditions': [
					[ 'OS == "win"', { 'defines': [ 'NOMSG', 'NOMINMAX', 'WIN32_LEAN_AND_MEAN' ] } ],
				],
			},
			'Release': {
				'inherit_from': [ 'Common' ],
				# --- Size Optimization Flags ---
				# GCC/Clang specific compiler flags for size
				'cflags': [
					'-Os',								# Optimize for size (-Oz is more aggressive but potentially slower)
					'-fvisibility=hidden', # Hide internal symbols, reducing export table size & allowing more optimization
					'-fdata-sections',		# Place data items into their own sections
					'-ffunction-sections', # Place functions into their own sections
					'-flto',							# Enable Link-Time Optimization (compiler part)
					'-Wno-deprecated-declarations', # Keep original warning suppression
				],
				# GCC/Clang specific linker flags for size
				'ldflags': [
					'-Wl,--gc-sections', # Enable garbage collection of unused sections (requires -ffunction-sections/-fdata-sections)
					'-flto',						 # Enable Link-Time Optimization (linker part)
				],
				'xcode_settings': {
					# Use 's' for Optimize for Size (-Os)
					'GCC_OPTIMIZATION_LEVEL': 's',
					# Enable LTO (-flto equivalent)
					'LLVM_LTO': 'YES',
					# Hide symbols (-fvisibility=hidden equivalent)
					'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES',
					# Equivalent to --gc-sections (requires -ffunction-sections/-fdata-sections implicitly enabled by LTO sometimes, or add explicitly below)
					'DEAD_CODE_STRIPPING': 'YES',
					'OTHER_CFLAGS': [
						# Explicitly add section flags if needed, though LTO might handle it. Redundant doesn't hurt.
						'-fdata-sections',
						'-ffunction-sections',
						'-Wno-deprecated-declarations', # Keep original warning suppression
					],
					# Note: -flto is handled by LLVM_LTO, --gc-sections by DEAD_CODE_STRIPPING
					'OTHER_LDFLAGS': [],
				},
				'msvs_settings': {
					'VCCLCompilerTool': {
						# /O1 optimizes for size (/O2 is for speed)
						'Optimization': '1',
						# /GL enables Whole Program Optimization (LTO equivalent)
						'WholeProgramOptimization': 'true',
						# /Gy enables Function-Level Linking (needed for linker optimization)
						'FunctionLevelLinking': 'true',
						# /GF enables String Pooling
						'StringPooling': 'true',
					},
					'VCLinkerTool': {
						# /LTCG enables Link Time Code Generation (LTO equivalent)
						'LinkTimeCodeGeneration': '1', # Use LTO
						# /OPT:REF removes unreferenced functions/data (requires /Gy)
						'OptimizeReferences': '2',
						# /OPT:ICF performs COMDAT folding (merges identical code/data)
						'EnableCOMDATFolding': '2',
					},
				},
				'msvs_disabled_warnings': [
					4996, # Deprecation
				],
			},
			'Debug': {
				# Debug configuration remains unchanged
				'inherit_from': [ 'Common' ],
				'defines': [ 'V8_IMMINENT_DEPRECATION_WARNINGS' ],
				'optimizations': '0', # Explicitly disable optimizations for debug
				'msvs_settings': {
					'VCCLCompilerTool': {
						'Optimization': '0', # /Od
					},
				},
				'xcode_settings': {
					'GCC_OPTIMIZATION_LEVEL': '0', # -O0
				},
			},
		},
	},
	'targets': [
		{
			'target_name': 'isolated_vm',
			'cflags_cc!': [ '-fno-rtti' ],
			'xcode_settings': {
				'GCC_ENABLE_CPP_RTTI': 'YES',
			},
			'msvs_settings': {
				'VCCLCompilerTool': {
					'RuntimeTypeInfo': 'true',
				},
			},
			'conditions': [
				[ 'OS == "linux"', { 'defines': [ 'USE_CLOCK_THREAD_CPUTIME_ID' ] } ],
				# Apply size optimization flags to this specific target too
				[
					'CONFIGURATION_NAME=="Release"',
					{
						'cflags': [
							'-Os',
							'-fvisibility=hidden',
							'-fdata-sections',
							'-ffunction-sections',
							'-flto',
						],
						'ldflags': [
							'-Wl,--gc-sections',
							'-flto',
						],
						'xcode_settings': {
							'GCC_OPTIMIZATION_LEVEL': 's',
							'LLVM_LTO': 'YES',
							'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES',
							'DEAD_CODE_STRIPPING': 'YES',
							'OTHER_CFLAGS': [
								'-fdata-sections',
								'-ffunction-sections',
							],
						},
						'msvs_settings': {
							'VCCLCompilerTool': {
								'Optimization': '1',
								'WholeProgramOptimization': 'true',
								'FunctionLevelLinking': 'true',
								'StringPooling': 'true',
							},
							'VCLinkerTool': {
								'LinkTimeCodeGeneration': '1',
								'OptimizeReferences': '2',
								'EnableCOMDATFolding': '2',
							},
						},
					}
				],
			],
			'sources': [
				'src/external_copy/external_copy.cc',
				'src/external_copy/serializer.cc',
				'src/external_copy/serializer_nortti.cc',
				'src/external_copy/string.cc',
				'src/isolate/allocator_nortti.cc',
				'src/isolate/environment.cc',
				"src/isolate/cpu_profile_manager.cc",
				'src/isolate/executor.cc',
				'src/isolate/holder.cc',
				'src/isolate/inspector.cc',
				'src/isolate/platform_delegate.cc',
				'src/isolate/scheduler.cc',
				'src/isolate/stack_trace.cc',
				'src/isolate/three_phase_task.cc',
				'src/lib/thread_pool.cc',
				'src/lib/timer.cc',
				'src/module/callback.cc',
				'src/module/context_handle.cc',
				'src/module/evaluation.cc',
				'src/module/external_copy_handle.cc',
				'src/module/isolate.cc',
				'src/module/isolate_handle.cc',
				'src/module/lib_handle.cc',
				'src/module/module_handle.cc',
				'src/module/native_module_handle.cc',
				'src/module/reference_handle.cc',
				'src/module/script_handle.cc',
				'src/module/session_handle.cc',
				'src/module/transferable.cc'
			],
			'conditions': [
				[
					'OS != "win"',
					{
						'dependencies': [ 'nortti' ],
						'sources/': [ [ 'exclude', '_nortti\\.cc$'] ],
					}
				],
			],
			'libraries': [
				'<!@(node -e "process.config.target_defaults.libraries.map(flag=>console.log(flag))")'
			],
		},
		{
			# Static library - Apply relevant compiler flags for size here too
			'target_name': 'nortti',
			'type': 'static_library',
			'conditions': [
				[
					'CONFIGURATION_NAME=="Release"',
					{
						'cflags': [
							'-Os',
							'-fvisibility=hidden', # Less critical for static lib, but good practice
							'-fdata-sections',
							'-ffunction-sections',
							# No LTO flags needed at static lib compile time usually, applied at final link
						],
						'xcode_settings': {
							'GCC_OPTIMIZATION_LEVEL': 's',
							'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES',
							'OTHER_CFLAGS': [
								'-fdata-sections',
								'-ffunction-sections',
							],
						},
						'msvs_settings': {
							'VCCLCompilerTool': {
								'Optimization': '1',
								# No /GL for static libs unless you manage LTO manually across lib/final link
								'FunctionLevelLinking': 'true',
								'StringPooling': 'true',
							},
						},
					}
				]
			],
			'sources': [
				'src/external_copy/serializer_nortti.cc',
				'src/isolate/allocator_nortti.cc',
			],
		},
		{
			'target_name': 'action_after_build',
			'type': 'none',
			'dependencies': [ 'isolated_vm' ],
			'copies': [
				{
					'files': [ '<(PRODUCT_DIR)/isolated_vm.node' ],
					'destination': 'out',
				}
			],
		},
	],
}